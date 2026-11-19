import { createHash } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { eq, inArray, sql } from 'drizzle-orm'
import { esUuidValido } from '@/server/db/consultas'
import { conTransaccionDb } from '@/server/db/contexto-db'
import { bloqueosAcceso, perfiles } from '@/server/db/schema'
import { obtenerEnv } from '@/server/env'
import { nombresCookies } from '@/server/nombres-cookies'
import type { Reloj } from '@/shared/application/ports/reloj'
import { DemasiadasPeticiones } from '@/shared/domain/errores'
import { crearRelojSistema } from '@/shared/infrastructure/reloj'
import type { AlmacenCookies, OpcionesCookie } from '../application/ports/almacen-cookies'
import type { IdentityProvider } from '../application/ports/identity-provider'
import { AccesoNoActivado, CodigoMfaInvalido, CredencialesInvalidas, DesafioMfaExpirado } from '../domain/errores'
import type { Identidad } from '../domain/identidad'
import { Rol } from '../domain/roles'
import { crearFirmador } from './firma-tokens'

const DESAFIO_MINUTOS = 5
const MINUTOS_INACTIVIDAD_POR_DEFECTO = 30
const HORAS_MAXIMAS_POR_DEFECTO = 8
const SEGUNDOS_BLOQUEO_3_FALLOS = 60
const SEGUNDOS_BLOQUEO_4_FALLOS = 300
const SEGUNDOS_BLOQUEO_5_MAS_FALLOS = 900
/** Ventana del contador por correo (solo retardo): pasado este tiempo sin fallos vuelve a cero. */
const MINUTOS_VENTANA_RETARDO = 15
const RETARDO_MAXIMO_MS = 4_000

export type ConfiguracionSupabaseAuth = Readonly<{
  url: string
  /** Clave anónima. Aquí NO lleva NEXT_PUBLIC_: el navegador nunca habla con Supabase. */
  claveAnonima: string
  cookiesSeguras?: boolean | undefined
  nombreCookieSesion?: string | undefined
  nombreCookieActividad?: string | undefined
  nombreCookieDesafio?: string | undefined
  secretoActividad?: string | undefined
  inactividadMinutos?: number | undefined
  duracionMaximaHoras?: number | undefined
  reloj?: Reloj | undefined
  /** Inyectable en tests para no esperar de verdad el retardo por correo. */
  esperar?: ((ms: number) => Promise<void>) | undefined
}>

type ActividadSesion = Readonly<{
  creadaEn: number
  ultimoUso: number
}>

function hashIdentificador(identificador: string): string {
  return createHash('sha256').update(identificador).digest('hex')
}

const esperarReal = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Retardo por correo (desde cualquier IP): frena el ataque distribuido sin bloquear la
 * cuenta. 0 s hasta 2 fallos; 1 s, 2 s y 4 s (tope) a partir del tercero dentro de la ventana.
 */
export function retardoPorCorreoMs(fallos: number, ultimoFallo: Date | null, ahora: Date): number {
  if (fallos < 3 || !ultimoFallo) return 0
  if (ahora.getTime() - ultimoFallo.getTime() > MINUTOS_VENTANA_RETARDO * 60_000) return 0
  return Math.min(RETARDO_MAXIMO_MS, 1_000 * 2 ** (fallos - 3))
}

function esErrorDesafioExpirado(error: {
  code?: string | undefined
  status?: number | undefined
  message?: string | undefined
}): boolean {
  const codigosExpirados = new Set([
    'session_expired',
    'session_not_found',
    'mfa_factor_not_found',
    'mfa_challenge_expired',
    'bad_jwt',
    'user_not_found',
  ])
  if (error.code && codigosExpirados.has(error.code)) return true
  if (error.status === 401 || error.status === 403 || error.status === 404) return true
  const mensaje = (error.message ?? '').toLowerCase()
  return mensaje.includes('session') || mensaje.includes('factor not found') || mensaje.includes('challenge expired')
}

async function obtenerNombrePerfil(user: User): Promise<string> {
  if (esUuidValido(user.id)) {
    try {
      const filas = await conTransaccionDb(
        (tx) => tx.select({ nombre: perfiles.nombre }).from(perfiles).where(eq(perfiles.userId, user.id)).limit(1),
        { modo: 'sistema' },
      )
      const nombrePerfil = filas[0]?.nombre.trim()
      if (nombrePerfil) return nombrePerfil
    } catch {
      // `perfiles` es solo de visualización; si falla o no hay perfil se usa el respaldo de display.
    }
  }

  const nombreMetadata = user.user_metadata?.nombre
  if (typeof nombreMetadata === 'string' && nombreMetadata.trim().length > 0) {
    return nombreMetadata.trim()
  }
  return user.email ?? 'Usuario'
}

/**
 * IdentityProvider real sobre Supabase Auth (`@supabase/ssr`) + MFA TOTP obligatorio.
 * - Valida identidad con `auth.getUser()` + `auth.getClaims()` + `auth.mfa.getAuthenticatorAssuranceLevel()`.
 * - Extrae el rol exclusivamente de `claims.app_metadata.rol` (Custom Access Token Hook).
 * - Mantiene bloqueo progresivo por hash de correo en `public.bloqueos_acceso` y
 *   expiración por inactividad/duración máxima mediante cookie firmada HttpOnly.
 */
export function crearIdentityProviderSupabase(config: ConfiguracionSupabaseAuth): IdentityProvider {
  const cookiesSeguras = config.cookiesSeguras ?? config.url.startsWith('https://')
  const cookiesDefecto = nombresCookies(cookiesSeguras)
  const nombreCookieSesion = config.nombreCookieSesion ?? cookiesDefecto.sesion
  const nombreCookieDesafio = config.nombreCookieDesafio ?? cookiesDefecto.desafioMfa
  const nombreCookieActividad = config.nombreCookieActividad ?? `${cookiesSeguras ? '__Host-' : ''}proinserco_actividad`
  const inactividadMinutos = config.inactividadMinutos ?? MINUTOS_INACTIVIDAD_POR_DEFECTO
  const duracionMaximaHoras = config.duracionMaximaHoras ?? HORAS_MAXIMAS_POR_DEFECTO
  const reloj = config.reloj ?? crearRelojSistema()
  const esperar = config.esperar ?? esperarReal

  /**
   * Contador por correo desde CUALQUIER IP: solo alimenta el retardo, nunca bloquea la
   * cuenta (el bloqueo duro es por correo + IP, en iniciarSesion). Ventana de 15 min.
   */
  async function registrarFalloPorCorreo(hashCorreo: string, momentoFallo: Date): Promise<void> {
    const inicioVentana = new Date(momentoFallo.getTime() - MINUTOS_VENTANA_RETARDO * 60_000)
    await conTransaccionDb(
      async (tx) => {
        await tx
          .insert(bloqueosAcceso)
          .values({
            identificadorHash: hashCorreo,
            fallosConsecutivos: 1,
            primerFalloEn: momentoFallo,
            ultimoFalloEn: momentoFallo,
            bloqueadoHasta: null,
            creadoEn: momentoFallo,
            actualizadoEn: momentoFallo,
          })
          .onConflictDoUpdate({
            target: bloqueosAcceso.identificadorHash,
            set: {
              // Si el último fallo es viejo, el contador vuelve a empezar.
              fallosConsecutivos: sql`CASE
                WHEN ${bloqueosAcceso.ultimoFalloEn} IS NULL
                  OR ${bloqueosAcceso.ultimoFalloEn} < ${sql.param(inicioVentana, bloqueosAcceso.ultimoFalloEn)}::timestamptz
                THEN 1
                ELSE ${bloqueosAcceso.fallosConsecutivos} + 1
              END`,
              primerFalloEn: sql`COALESCE(${bloqueosAcceso.primerFalloEn}, ${sql.param(momentoFallo, bloqueosAcceso.primerFalloEn)}::timestamptz)`,
              ultimoFalloEn: momentoFallo,
              bloqueadoHasta: sql`NULL::timestamptz`,
              actualizadoEn: momentoFallo,
            },
          })
      },
      { modo: 'sistema' },
    )
  }

  let cacheFirmador: ReturnType<typeof crearFirmador> | null = config.secretoActividad
    ? crearFirmador(config.secretoActividad)
    : null

  const obtenerFirmador = () => {
    cacheFirmador ??= crearFirmador(obtenerEnv().SESION_SECRETO)
    return cacheFirmador
  }

  const opcionesCookie = (maxAgeSegundos?: number): OpcionesCookie => ({
    httpOnly: true,
    secure: cookiesSeguras,
    sameSite: 'strict',
    path: '/',
    ...(maxAgeSegundos ? { maxAgeSegundos } : {}),
  })

  function crearCliente(cookies: AlmacenCookies) {
    return createServerClient(config.url, config.claveAnonima, {
      cookies: {
        getAll() {
          return cookies.todas().map(({ nombre, valor }) => ({ name: nombre, value: valor }))
        },
        setAll(cookiesPorEscribir) {
          try {
            for (const { name, value, options } of cookiesPorEscribir) {
              const maxAge = options?.maxAge
              const expiraEnPasado = options?.expires ? options.expires.getTime() <= 0 : false
              if (value === '' || maxAge === 0 || expiraEnPasado) {
                cookies.eliminar(name)
                continue
              }
              cookies.establecer(name, value, {
                httpOnly: true,
                secure: cookiesSeguras,
                sameSite: 'strict',
                path: options?.path ?? '/',
                ...(typeof maxAge === 'number' && maxAge > 0 ? { maxAgeSegundos: maxAge } : {}),
              })
            }
          } catch {
            // En Server Components `cookies()` es de solo lectura (patrón oficial de @supabase/ssr).
          }
        },
      },
      cookieOptions: {
        name: nombreCookieSesion,
        httpOnly: true,
        secure: cookiesSeguras,
        sameSite: 'strict',
        path: '/',
      },
    })
  }

  function limpiarCookiesAuth(cookies: AlmacenCookies): void {
    try {
      for (const { nombre } of cookies.todas()) {
        if (nombre === nombreCookieSesion || nombre.startsWith(`${nombreCookieSesion}.`)) {
          cookies.eliminar(nombre)
        }
      }
      cookies.eliminar(nombreCookieSesion)
      cookies.eliminar(nombreCookieActividad)
      cookies.eliminar(nombreCookieDesafio)
    } catch {
      // En Server Components las cookies son de solo lectura.
    }
  }

  function leerActividad(raw: string | undefined, usuarioId: string): ActividadSesion | null {
    const carga = obtenerFirmador().verificar(raw)
    if (!carga) return null
    const [uid, creadaRaw, ultimoRaw] = carga.split('|')
    if (!uid || uid !== usuarioId) return null
    const creadaEn = Number(creadaRaw)
    const ultimoUso = Number(ultimoRaw)
    if (!Number.isFinite(creadaEn) || !Number.isFinite(ultimoUso) || creadaEn <= 0 || ultimoUso <= 0) {
      return null
    }
    return { creadaEn, ultimoUso }
  }

  async function resolverIdentidad(
    supabase: ReturnType<typeof crearCliente>,
    cookies: AlmacenCookies,
  ): Promise<Identidad | null> {
    const {
      data: { user },
      error: errorUser,
    } = await supabase.auth.getUser()
    if (errorUser || !user) return null

    const { data: claimsData, error: errorClaims } = await supabase.auth.getClaims()
    if (errorClaims || !claimsData?.claims) return null

    const appMeta = claimsData.claims.app_metadata
    const rolCrudo = appMeta && typeof appMeta === 'object' ? (appMeta as Record<string, unknown>).rol : undefined
    const rolParseado = Rol.safeParse(rolCrudo)
    if (!rolParseado.success) return null

    const { data: aalData, error: errorAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (errorAal || !aalData) return null

    const nivel = aalData.currentLevel === 'aal2' ? 'aal2' : 'aal1'
    const ahoraMs = reloj.ahora().getTime()
    const rawActividad = cookies.obtener(nombreCookieActividad)
    const actividad = leerActividad(rawActividad, user.id)

    let expiraEn: Date

    if (rawActividad !== undefined && !actividad) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      limpiarCookiesAuth(cookies)
      return null
    }

    if (actividad) {
      const inactiva = ahoraMs - actividad.ultimoUso > inactividadMinutos * 60_000
      const vencida = ahoraMs - actividad.creadaEn > duracionMaximaHoras * 3_600_000
      if (inactiva || vencida) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        limpiarCookiesAuth(cookies)
        return null
      }

      const nuevaCarga = `${user.id}|${actividad.creadaEn}|${ahoraMs}`
      const expiraAbsoluta = actividad.creadaEn + duracionMaximaHoras * 3_600_000
      const expiraPorInactividad = ahoraMs + inactividadMinutos * 60_000
      const ttlRestanteSegundos = Math.max(1, Math.ceil((expiraAbsoluta - ahoraMs) / 1000))

      try {
        cookies.establecer(nombreCookieActividad, obtenerFirmador().firmar(nuevaCarga), opcionesCookie(ttlRestanteSegundos))
      } catch {
        // Server Component de solo lectura: la cookie no se refresca aquí, pero la sesión sigue vigente.
      }
      expiraEn = new Date(Math.min(expiraPorInactividad, expiraAbsoluta))
    } else if (nivel === 'aal2') {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      limpiarCookiesAuth(cookies)
      return null
    } else {
      const expJwtMs =
        typeof claimsData.claims.exp === 'number' ? claimsData.claims.exp * 1000 : ahoraMs + DESAFIO_MINUTOS * 60_000
      expiraEn = new Date(expJwtMs)
    }

    const nombre = await obtenerNombrePerfil(user)
    const correo = user.email ?? (typeof claimsData.claims.email === 'string' ? claimsData.claims.email : '')

    return {
      usuarioId: user.id,
      correo,
      nombre,
      rol: rolParseado.data,
      nivel,
      expiraEn,
    }
  }

  return {
    async iniciarSesion({ correo, contrasena }, cookies, contexto) {
      const correoNormalizado = correo.trim().toLowerCase()
      // Bloqueo DURO por correo + IP: 5 intentos desde una IP no pueden dejar fuera a un
      // administrador que entra desde otra. Por correo (cualquier IP) solo hay RETARDO.
      const identificadorHash = hashIdentificador(`${correoNormalizado}|${contexto?.ip ?? 'desconocida'}`)
      const hashCorreo = hashIdentificador(correoNormalizado)
      const ahora = reloj.ahora()

      const filas = await conTransaccionDb(
        (tx) =>
          tx
            .select({
              identificadorHash: bloqueosAcceso.identificadorHash,
              bloqueadoHasta: bloqueosAcceso.bloqueadoHasta,
              fallosConsecutivos: bloqueosAcceso.fallosConsecutivos,
              ultimoFalloEn: bloqueosAcceso.ultimoFalloEn,
            })
            .from(bloqueosAcceso)
            .where(inArray(bloqueosAcceso.identificadorHash, [identificadorHash, hashCorreo])),
        { modo: 'sistema' },
      )
      const bloqueo = filas.find((f) => f.identificadorHash === identificadorHash)?.bloqueadoHasta ?? null
      if (bloqueo && bloqueo.getTime() > ahora.getTime()) {
        const reintentarEnSegundos = Math.max(1, Math.ceil((bloqueo.getTime() - ahora.getTime()) / 1000))
        throw new DemasiadasPeticiones(reintentarEnSegundos)
      }

      const porCorreo = filas.find((f) => f.identificadorHash === hashCorreo)
      const retardo = retardoPorCorreoMs(porCorreo?.fallosConsecutivos ?? 0, porCorreo?.ultimoFalloEn ?? null, ahora)
      if (retardo > 0) await esperar(retardo)

      const supabase = crearCliente(cookies)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correoNormalizado,
        password: contrasena,
      })

      if (error || !data.user) {
        const momentoFallo = reloj.ahora()
        const bloqueo3 = new Date(momentoFallo.getTime() + SEGUNDOS_BLOQUEO_3_FALLOS * 1000)
        const bloqueo4 = new Date(momentoFallo.getTime() + SEGUNDOS_BLOQUEO_4_FALLOS * 1000)
        const bloqueo5 = new Date(momentoFallo.getTime() + SEGUNDOS_BLOQUEO_5_MAS_FALLOS * 1000)

        await conTransaccionDb(
          async (tx) => {
            await tx
              .insert(bloqueosAcceso)
              .values({
                identificadorHash,
                fallosConsecutivos: 1,
                primerFalloEn: momentoFallo,
                ultimoFalloEn: momentoFallo,
                bloqueadoHasta: null,
                creadoEn: momentoFallo,
                actualizadoEn: momentoFallo,
              })
              .onConflictDoUpdate({
                target: bloqueosAcceso.identificadorHash,
                set: {
                  fallosConsecutivos: sql`${bloqueosAcceso.fallosConsecutivos} + 1`,
                  // Los parámetros viajan sin tipo: dentro de CASE/COALESCE Postgres los
                  // resuelve como `text` y falla al asignarlos a `timestamptz`. Cast explícito.
                  primerFalloEn: sql`COALESCE(${bloqueosAcceso.primerFalloEn}, ${sql.param(momentoFallo, bloqueosAcceso.primerFalloEn)}::timestamptz)`,
                  ultimoFalloEn: momentoFallo,
                  bloqueadoHasta: sql`CASE
                    WHEN ${bloqueosAcceso.fallosConsecutivos} + 1 >= 5 THEN ${sql.param(bloqueo5, bloqueosAcceso.bloqueadoHasta)}::timestamptz
                    WHEN ${bloqueosAcceso.fallosConsecutivos} + 1 = 4 THEN ${sql.param(bloqueo4, bloqueosAcceso.bloqueadoHasta)}::timestamptz
                    WHEN ${bloqueosAcceso.fallosConsecutivos} + 1 = 3 THEN ${sql.param(bloqueo3, bloqueosAcceso.bloqueadoHasta)}::timestamptz
                    ELSE NULL::timestamptz
                  END`,
                  actualizadoEn: momentoFallo,
                },
              })
          },
          { modo: 'sistema' },
        )
        await registrarFalloPorCorreo(hashCorreo, momentoFallo)
        throw new CredencialesInvalidas()
      }

      await conTransaccionDb(
        async (tx) => {
          await tx.delete(bloqueosAcceso).where(inArray(bloqueosAcceso.identificadorHash, [identificadorHash, hashCorreo]))
        },
        { modo: 'sistema' },
      )

      const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors()
      if (errorFactores || !factores) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        limpiarCookiesAuth(cookies)
        throw new Error('No fue posible consultar los factores MFA del usuario')
      }

      // Sin TOTP verificado NO se ofrece enrolarlo aquí: con solo la contraseña nadie
      // puede registrar su propio segundo factor. Lo activa el alta administrativa.
      if (!factores.totp.some((f) => f.status === 'verified')) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        limpiarCookiesAuth(cookies)
        throw new AccesoNoActivado()
      }

      cookies.eliminar(nombreCookieDesafio)
      return { usuarioId: data.user.id }
    },

    async desafioPendiente(cookies) {
      const supabase = crearCliente(cookies)
      const {
        data: { user },
        error: errorUser,
      } = await supabase.auth.getUser()
      if (errorUser || !user) return null

      const { data: aalData, error: errorAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (errorAal || !aalData) return null

      return aalData.currentLevel === 'aal1' ? user.id : null
    },

    async verificarSegundoFactor(codigo, cookies) {
      const supabase = crearCliente(cookies)
      const {
        data: { user },
        error: errorUser,
      } = await supabase.auth.getUser()
      if (errorUser || !user) throw new DesafioMfaExpirado()

      const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors()
      if (errorFactores || !factores) throw new DesafioMfaExpirado()

      // Solo factores YA verificados (enrolados en el alta). Nunca uno recién creado.
      const factorId = factores.totp.find((f) => f.status === 'verified')?.id
      if (!factorId) throw new DesafioMfaExpirado()

      const { error: errorVerify } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: codigo,
      })

      if (errorVerify) {
        if (esErrorDesafioExpirado(errorVerify)) throw new DesafioMfaExpirado()
        throw new CodigoMfaInvalido()
      }

      cookies.eliminar(nombreCookieDesafio)
      const ahoraMs = reloj.ahora().getTime()
      const cargaActividad = `${user.id}|${ahoraMs}|${ahoraMs}`
      cookies.establecer(
        nombreCookieActividad,
        obtenerFirmador().firmar(cargaActividad),
        opcionesCookie(duracionMaximaHoras * 3600),
      )

      const identidad = await resolverIdentidad(supabase, cookies)
      if (identidad?.nivel !== 'aal2') {
        throw new DesafioMfaExpirado()
      }
      return identidad
    },

    async obtenerIdentidad(cookies) {
      const supabase = crearCliente(cookies)
      return resolverIdentidad(supabase, cookies)
    },

    async cerrarSesion(cookies) {
      const supabase = crearCliente(cookies)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      limpiarCookiesAuth(cookies)
    },
  }
}
