import { createHash } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { eq, sql } from 'drizzle-orm'
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
import { CodigoMfaInvalido, CredencialesInvalidas, DesafioMfaExpirado } from '../domain/errores'
import type { Identidad } from '../domain/identidad'
import { Rol } from '../domain/roles'
import { crearFirmador } from './firma-tokens'

const DESAFIO_MINUTOS = 5
const MINUTOS_INACTIVIDAD_POR_DEFECTO = 30
const HORAS_MAXIMAS_POR_DEFECTO = 8
const SEGUNDOS_BLOQUEO_3_FALLOS = 60
const SEGUNDOS_BLOQUEO_4_FALLOS = 300
const SEGUNDOS_BLOQUEO_5_MAS_FALLOS = 900

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
}>

type ActividadSesion = Readonly<{
  creadaEn: number
  ultimoUso: number
}>

function hashIdentificador(correo: string): string {
  return createHash('sha256').update(correo).digest('hex')
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

  function leerDesafioEnrolamiento(cookies: AlmacenCookies, usuarioId: string): string | null {
    const carga = obtenerFirmador().verificar(cookies.obtener(nombreCookieDesafio))
    if (!carga) return null
    const [uid, factorId, expira] = carga.split('|')
    if (!uid || !factorId || uid !== usuarioId) return null
    const expiraMs = Number(expira)
    if (!Number.isFinite(expiraMs) || expiraMs < reloj.ahora().getTime()) return null
    return factorId
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
    async iniciarSesion({ correo, contrasena }, cookies) {
      const correoNormalizado = correo.trim().toLowerCase()
      const identificadorHash = hashIdentificador(correoNormalizado)
      const ahora = reloj.ahora()

      const bloqueo = await conTransaccionDb(
        async (tx) => {
          const [fila] = await tx
            .select({ bloqueadoHasta: bloqueosAcceso.bloqueadoHasta })
            .from(bloqueosAcceso)
            .where(eq(bloqueosAcceso.identificadorHash, identificadorHash))
            .limit(1)
          return fila?.bloqueadoHasta ?? null
        },
        { modo: 'sistema' },
      )

      if (bloqueo && bloqueo.getTime() > ahora.getTime()) {
        const reintentarEnSegundos = Math.max(1, Math.ceil((bloqueo.getTime() - ahora.getTime()) / 1000))
        throw new DemasiadasPeticiones(reintentarEnSegundos)
      }

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
                  primerFalloEn: sql`COALESCE(${bloqueosAcceso.primerFalloEn}, ${sql.param(momentoFallo, bloqueosAcceso.primerFalloEn)})`,
                  ultimoFalloEn: momentoFallo,
                  bloqueadoHasta: sql`CASE
                    WHEN ${bloqueosAcceso.fallosConsecutivos} + 1 >= 5 THEN ${sql.param(bloqueo5, bloqueosAcceso.bloqueadoHasta)}
                    WHEN ${bloqueosAcceso.fallosConsecutivos} + 1 = 4 THEN ${sql.param(bloqueo4, bloqueosAcceso.bloqueadoHasta)}
                    WHEN ${bloqueosAcceso.fallosConsecutivos} + 1 = 3 THEN ${sql.param(bloqueo3, bloqueosAcceso.bloqueadoHasta)}
                    ELSE NULL
                  END`,
                  actualizadoEn: momentoFallo,
                },
              })
          },
          { modo: 'sistema' },
        )
        throw new CredencialesInvalidas()
      }

      await conTransaccionDb(
        async (tx) => {
          await tx.delete(bloqueosAcceso).where(eq(bloqueosAcceso.identificadorHash, identificadorHash))
        },
        { modo: 'sistema' },
      )

      const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors()
      if (errorFactores || !factores) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        limpiarCookiesAuth(cookies)
        throw new Error('No fue posible consultar los factores MFA del usuario')
      }

      const factorVerificado = factores.totp.find((f) => f.status === 'verified')
      if (factorVerificado) {
        cookies.eliminar(nombreCookieDesafio)
        return { usuarioId: data.user.id }
      }

      for (const factor of factores.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      }

      const { data: enrolado, error: errorEnroll } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Panel Proinserco',
      })

      if (errorEnroll || !enrolado) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        limpiarCookiesAuth(cookies)
        throw new Error('No fue posible iniciar el enrolamiento MFA TOTP')
      }

      const expira = reloj.ahora().getTime() + DESAFIO_MINUTOS * 60_000
      const carga = `${data.user.id}|${enrolado.id}|${expira}`
      cookies.establecer(nombreCookieDesafio, obtenerFirmador().firmar(carga), opcionesCookie(DESAFIO_MINUTOS * 60))

      return {
        usuarioId: data.user.id,
        enrolamientoMfa: {
          factorId: enrolado.id,
          qrSvg: enrolado.totp.qr_code,
          secreto: enrolado.totp.secret,
          uri: enrolado.totp.uri,
        },
      }
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

      const factorVerificado = factores.totp.find((f) => f.status === 'verified')
      const factorIdEnrolado = factorVerificado ? null : leerDesafioEnrolamiento(cookies, user.id)
      const factorEnrolado = factorIdEnrolado
        ? factores.all.find((f) => f.id === factorIdEnrolado && f.factor_type === 'totp')
        : undefined
      const factorId = factorVerificado?.id ?? factorEnrolado?.id

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
