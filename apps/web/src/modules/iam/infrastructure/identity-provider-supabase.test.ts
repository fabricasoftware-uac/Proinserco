import { createHash } from 'node:crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseDatos } from '@/server/db/cliente'
import * as schema from '@/server/db/schema'
import { DemasiadasPeticiones } from '@/shared/domain/errores'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'
import type { AlmacenCookies } from '../application/ports/almacen-cookies'
import { AccesoNoActivado, CodigoMfaInvalido, CredencialesInvalidas, DesafioMfaExpirado } from '../domain/errores'
import { crearIdentityProviderSupabase, retardoPorCorreoMs } from './identity-provider-supabase'

type Consulta = { sql: string; params: unknown[] }

const { createServerClientMock, obtenerDbMock, authMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  obtenerDbMock: vi.fn<() => BaseDatos>(),
  authMock: {
    signInWithPassword: vi.fn(),
    getUser: vi.fn(),
    getClaims: vi.fn(),
    signOut: vi.fn(),
    mfa: {
      listFactors: vi.fn(),
      unenroll: vi.fn(),
      enroll: vi.fn(),
      challengeAndVerify: vi.fn(),
      getAuthenticatorAssuranceLevel: vi.fn(),
    },
  },
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/server/db/cliente', () => ({
  obtenerDb: obtenerDbMock,
}))

function crearDbInstrumentada(respondedor: (sql: string, params: unknown[]) => unknown[]) {
  const consultas: Consulta[] = []
  const unsafe = (query: string, params: unknown[] = []) => {
    consultas.push({ sql: query, params })
    const filas = respondedor(query, params)
    return Object.assign(Promise.resolve(filas), {
      values: async () => filas,
    })
  }
  const clienteFalso = {
    options: { parsers: {} as Record<string, unknown>, serializers: {} as Record<string, unknown> },
    unsafe,
    begin: async <T>(cb: (txClient: { unsafe: typeof unsafe }) => Promise<T>) => cb({ unsafe }),
  }
  const db = drizzle(clienteFalso as unknown as Sql, { schema })
  return { db, consultas }
}

function crearCookies(): AlmacenCookies & { mapa: Map<string, string> } {
  const mapa = new Map<string, string>()
  return {
    mapa,
    obtener: (n) => mapa.get(n),
    todas: () => [...mapa].map(([nombre, valor]) => ({ nombre, valor })),
    establecer: (n, v) => mapa.set(n, v),
    eliminar: (n) => mapa.delete(n),
  }
}

const USER_ID = '11111111-1111-4111-8111-111111111111'
const FACTOR_VERIFICADO = '22222222-2222-4222-8222-222222222222'
const FACTOR_ENROLADO = '33333333-3333-4333-8333-333333333333'
const FACTOR_VIEJO = '44444444-4444-4444-8444-444444444444'
const AHORA = new Date('2026-11-16T15:00:00.000Z')

describe('crearIdentityProviderSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.signOut.mockResolvedValue({ error: null })
    createServerClientMock.mockImplementation((_url, _key, options) => {
      // Simula que Supabase Auth escribe cookie de sesión al verificar o iniciar sesión.
      createServerClientMock.mock.calls.at(-1)
      return { auth: authMock, __options: options }
    })
  })

  function crearProvider(reloj = crearRelojFijo(AHORA), esperar: (ms: number) => Promise<void> = async () => undefined) {
    return crearIdentityProviderSupabase({
      url: 'https://proj.supabase.co',
      claveAnonima: 'anon-key',
      cookiesSeguras: true,
      nombreCookieSesion: '__Host-proinserco_sesion',
      nombreCookieActividad: '__Host-proinserco_actividad',
      nombreCookieDesafio: '__Host-proinserco_mfa',
      secretoActividad: 's'.repeat(48),
      inactividadMinutos: 30,
      duracionMaximaHoras: 8,
      reloj,
      esperar,
    })
  }

  it('iniciarSesion: bloqueo DURO por correo + IP (otra IP no queda bloqueada) y CredencialesInvalidas sin revelar usuario', async () => {
    const futuro = new Date(AHORA.getTime() + 45_000)
    const correo = 'admin@proinserco.test'
    const hashCorreo = createHash('sha256').update(correo).digest('hex')
    const hashCorreoIpAtacante = createHash('sha256').update(`${correo}|198.51.100.7`).digest('hex')

    const { db, consultas } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)
    authMock.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login' } })

    const provider = crearProvider()
    await expect(
      provider.iniciarSesion({ correo, contrasena: 'clave-muy-larga-123' }, crearCookies(), { ip: '198.51.100.7' }),
    ).rejects.toThrow(CredencialesInvalidas)

    const inserts = consultas.filter((c) => c.sql.includes('insert into "bloqueos_acceso"'))
    expect(inserts).toHaveLength(2)
    expect(inserts[0]?.params).toContain(hashCorreoIpAtacante)
    expect(inserts[0]?.sql).toContain('::timestamptz')
    expect(inserts[1]?.params).toContain(hashCorreo)
    // El contador por correo nunca fija bloqueado_hasta: solo sirve para el retardo.
    expect(inserts[1]?.sql).toContain('"bloqueado_hasta" = NULL::timestamptz')

    // Bloqueo vigente para (correo, IP del atacante): rechaza antes de llamar a Supabase Auth.
    const { db: dbBloqueado } = crearDbInstrumentada(() => [[hashCorreoIpAtacante, futuro.toISOString(), 5, AHORA.toISOString()]])
    obtenerDbMock.mockReturnValue(dbBloqueado)
    authMock.signInWithPassword.mockClear()
    await expect(
      provider.iniciarSesion({ correo, contrasena: 'clave-muy-larga-123' }, crearCookies(), { ip: '198.51.100.7' }),
    ).rejects.toThrow(DemasiadasPeticiones)
    expect(authMock.signInWithPassword).not.toHaveBeenCalled()
  })

  it('iniciarSesion: desde otra IP el administrador NO queda bloqueado; solo sufre el retardo por correo', async () => {
    const correo = 'admin@proinserco.test'
    const hashCorreo = createHash('sha256').update(correo).digest('hex')
    // 5 fallos recientes contra este correo (desde cualquier IP), sin fila para la IP del administrador.
    const { db } = crearDbInstrumentada(() => [[hashCorreo, null, 5, AHORA.toISOString()]])
    obtenerDbMock.mockReturnValue(db)
    authMock.signInWithPassword.mockResolvedValue({ data: { user: { id: USER_ID, email: correo } }, error: null })
    authMock.mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
        totp: [{ id: FACTOR_VERIFICADO, status: 'verified' }],
      },
      error: null,
    })
    const esperar = vi.fn(async () => undefined)

    const provider = crearProvider(crearRelojFijo(AHORA), esperar)
    await expect(
      provider.iniciarSesion({ correo, contrasena: 'clave-muy-larga-123' }, crearCookies(), { ip: '203.0.113.20' }),
    ).resolves.toEqual({ usuarioId: USER_ID })
    expect(esperar).toHaveBeenCalledWith(4_000)
  })

  it('retardoPorCorreoMs crece a partir del tercer fallo, tiene tope y caduca con la ventana', () => {
    const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000)
    expect(retardoPorCorreoMs(2, hace(1), AHORA)).toBe(0)
    expect(retardoPorCorreoMs(3, hace(1), AHORA)).toBe(1_000)
    expect(retardoPorCorreoMs(4, hace(1), AHORA)).toBe(2_000)
    expect(retardoPorCorreoMs(50, hace(1), AHORA)).toBe(4_000)
    expect(retardoPorCorreoMs(50, hace(16), AHORA)).toBe(0)
  })

  it('iniciarSesion SIN factor TOTP verificado NO enrola: cierra la sesión y lanza AccesoNoActivado', async () => {
    const { db } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)
    const provider = crearProvider()
    const cookies = crearCookies()
    cookies.mapa.set('__Host-proinserco_sesion.0', 'token-aal1')

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test' } },
      error: null,
    })
    authMock.mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: FACTOR_VIEJO, factor_type: 'totp', status: 'unverified' }], totp: [] },
      error: null,
    })

    const intento = provider.iniciarSesion({ correo: 'admin@proinserco.test', contrasena: 'clave-muy-larga-123' }, cookies, {
      ip: '192.0.2.1',
    })
    await expect(intento).rejects.toThrow(AccesoNoActivado)
    await expect(intento).rejects.toThrow('Pide al administrador que active tu acceso')
    expect(authMock.mfa.enroll).not.toHaveBeenCalled()
    expect(authMock.mfa.unenroll).not.toHaveBeenCalled()
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(cookies.mapa.has('__Host-proinserco_sesion.0')).toBe(false)
    expect(cookies.mapa.has('__Host-proinserco_mfa')).toBe(false)
  })

  it('iniciarSesion con TOTP verificado deja el desafío; verificarSegundoFactor usa SOLO el factor verificado', async () => {
    const { db, consultas } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)
    const provider = crearProvider()
    const cookies = crearCookies()

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test' } },
      error: null,
    })
    authMock.mfa.listFactors.mockResolvedValue({
      data: {
        all: [
          { id: FACTOR_ENROLADO, factor_type: 'totp', status: 'unverified' },
          { id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' },
        ],
        totp: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    })

    const res = await provider.iniciarSesion({ correo: 'admin@proinserco.test', contrasena: 'clave-muy-larga-123' }, cookies, {
      ip: '192.0.2.1',
    })
    expect(res).toEqual({ usuarioId: USER_ID })
    expect(consultas.some((c) => c.sql.includes('delete from "bloqueos_acceso"'))).toBe(true)
    expect(authMock.mfa.enroll).not.toHaveBeenCalled()

    authMock.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test', user_metadata: { rol: 'consulta' } } },
      error: null,
    })
    authMock.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    authMock.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: { rol: 'administrador' }, exp: Math.floor(AHORA.getTime() / 1000) + 3600 } },
      error: null,
    })
    authMock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: [] },
      error: null,
    })
    const { db: dbPerfil } = crearDbInstrumentada((sql) => (sql.includes('from "perfiles"') ? [['Ana Muñoz']] : []))
    obtenerDbMock.mockReturnValue(dbPerfil)

    const identidad = await provider.verificarSegundoFactor('123456', cookies)

    expect(authMock.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR_VERIFICADO, code: '123456' })
    expect(cookies.mapa.has('__Host-proinserco_mfa')).toBe(false)
    expect(cookies.mapa.has('__Host-proinserco_actividad')).toBe(true)
    expect(identidad).toMatchObject({
      usuarioId: USER_ID,
      correo: 'admin@proinserco.test',
      nombre: 'Ana Muñoz',
      rol: 'administrador',
      nivel: 'aal2',
    })
  })

  it('extrae rol exclusivamente de claims.app_metadata.rol, verifica inactividad y maneja cookies solo lectura', async () => {
    const { db } = crearDbInstrumentada((sql) => (sql.includes('from "perfiles"') ? [['Ana Perfil']] : []))
    obtenerDbMock.mockReturnValue(db)

    const reloj = crearRelojFijo(AHORA)
    const provider = crearProvider(reloj)
    const cookies = crearCookies()

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test' } },
      error: null,
    })
    authMock.mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
        totp: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    })
    authMock.getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'admin@proinserco.test',
          user_metadata: { rol: 'administrador', nombre: 'Nombre Inyectado' },
        },
      },
      error: null,
    })
    authMock.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    authMock.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: { rol: 'consulta' }, exp: Math.floor(AHORA.getTime() / 1000) + 3600 } },
      error: null,
    })
    authMock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: [] },
      error: null,
    })

    await provider.iniciarSesion({ correo: 'admin@proinserco.test', contrasena: 'clave-muy-larga-123' }, cookies, { ip: null })
    await provider.verificarSegundoFactor('654321', cookies)

    // Rol viene de app_metadata ('consulta'), jamás de user_metadata ('administrador')
    const cookiesSoloLectura: AlmacenCookies = {
      obtener: (n) => cookies.obtener(n),
      todas: () => cookies.todas(),
      establecer: () => {
        throw new Error('Cookies cannot be modified in a Server Component')
      },
      eliminar: () => {
        throw new Error('Cookies cannot be modified in a Server Component')
      },
    }
    const idLectura = await provider.obtenerIdentidad(cookiesSoloLectura)
    expect(idLectura?.rol).toBe('consulta')
    expect(idLectura?.nombre).toBe('Ana Perfil')

    // Sin rol válido en app_metadata -> null
    authMock.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: USER_ID, app_metadata: {}, exp: Math.floor(AHORA.getTime() / 1000) + 3600 } },
      error: null,
    })
    expect(await provider.obtenerIdentidad(cookies)).toBeNull()

    // Expiración por inactividad (> 30 min) revoca sesión y limpia cookies
    reloj.avanzar(31 * 60_000)
    expect(await provider.obtenerIdentidad(cookies)).toBeNull()
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(cookies.mapa.has('__Host-proinserco_actividad')).toBe(false)
  })

  it('mapea errores de MFA, soporta desafioPendiente y limpia chunks de sesión en cerrarSesion', async () => {
    const provider = crearProvider()
    const cookies = crearCookies()
    cookies.mapa.set('__Host-proinserco_sesion.0', 'chunk0')
    cookies.mapa.set('__Host-proinserco_sesion.1', 'chunk1')
    cookies.mapa.set('__Host-proinserco_actividad', 'act')
    cookies.mapa.set('__Host-proinserco_mfa', 'mfa')
    cookies.mapa.set('otra_cookie', 'conservar')

    authMock.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    authMock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2', currentAuthenticationMethods: [] },
      error: null,
    })
    expect(await provider.desafioPendiente(cookies)).toBe(USER_ID)

    authMock.mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
        totp: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    })
    authMock.mfa.challengeAndVerify.mockResolvedValueOnce({
      data: null,
      error: { code: 'mfa_verification_failed', status: 422, message: 'Invalid TOTP code' },
    })
    await expect(provider.verificarSegundoFactor('000000', cookies)).rejects.toThrow(CodigoMfaInvalido)

    authMock.mfa.challengeAndVerify.mockResolvedValueOnce({
      data: null,
      error: { code: 'session_not_found', status: 403, message: 'Session expired' },
    })
    await expect(provider.verificarSegundoFactor('000000', cookies)).rejects.toThrow(DesafioMfaExpirado)

    await provider.cerrarSesion(cookies)
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(cookies.mapa.has('__Host-proinserco_sesion.0')).toBe(false)
    expect(cookies.mapa.has('__Host-proinserco_sesion.1')).toBe(false)
    expect(cookies.mapa.has('__Host-proinserco_actividad')).toBe(false)
    expect(cookies.mapa.has('__Host-proinserco_mfa')).toBe(false)
    expect(cookies.mapa.get('otra_cookie')).toBe('conservar')
  })

  it('nunca verifica contra un factor sin verificar, rechaza cookie de actividad manipulada y borra cookie en setAll cuando maxAge=0', async () => {
    const { db } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)

    const reloj = crearRelojFijo(AHORA)
    const provider = crearProvider(reloj)
    const cookies = crearCookies()

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test' } },
      error: null,
    })
    authMock.mfa.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    })
    await expect(
      provider.iniciarSesion({ correo: 'admin@proinserco.test', contrasena: 'clave-muy-larga-123' }, cookies, { ip: null }),
    ).rejects.toThrow(AccesoNoActivado)

    // Aunque exista un factor sin verificar (p. ej. creado por un atacante), no se usa.
    reloj.avanzar(60_000)
    authMock.getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'admin@proinserco.test' } }, error: null })
    authMock.mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: FACTOR_ENROLADO, factor_type: 'totp', status: 'unverified' }], totp: [] },
      error: null,
    })
    await expect(provider.verificarSegundoFactor('123456', cookies)).rejects.toThrow(DesafioMfaExpirado)

    // Cookie de actividad manipulada en aal2 -> revoca y devuelve null
    cookies.mapa.set('__Host-proinserco_actividad', 'manipulada.firma')
    authMock.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: { rol: 'administrador' }, exp: Math.floor(AHORA.getTime() / 1000) + 3600 } },
      error: null,
    })
    authMock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: [] },
      error: null,
    })
    expect(await provider.obtenerIdentidad(cookies)).toBeNull()
    expect(cookies.mapa.has('__Host-proinserco_actividad')).toBe(false)

    // Verifica adaptador setAll de createServerClient (elimina con maxAge: 0, establece con HttpOnly+Strict)
    const ultimoCall = createServerClientMock.mock.calls.at(-1)
    const ssrOptions = ultimoCall?.[2] as {
      cookies: { setAll: (items: Array<{ name: string; value: string; options: Record<string, unknown> }>) => void }
    }
    ssrOptions.cookies.setAll([{ name: '__Host-proinserco_sesion.0', value: 'tok', options: { maxAge: 3600, path: '/' } }])
    expect(cookies.mapa.get('__Host-proinserco_sesion.0')).toBe('tok')
    ssrOptions.cookies.setAll([{ name: '__Host-proinserco_sesion.0', value: '', options: { maxAge: 0, path: '/' } }])
    expect(cookies.mapa.has('__Host-proinserco_sesion.0')).toBe(false)
  })

  it('revoca sesión aal2 si falta la cookie de actividad o si supera la duración máxima absoluta (8 h)', async () => {
    const { db } = crearDbInstrumentada((sql) => (sql.includes('from "perfiles"') ? [['Ana Perfil']] : []))
    obtenerDbMock.mockReturnValue(db)

    const reloj = crearRelojFijo(AHORA)
    const provider = crearProvider(reloj)
    const cookies = crearCookies()

    authMock.signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test' } },
      error: null,
    })
    authMock.mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
        totp: [{ id: FACTOR_VERIFICADO, factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    })
    authMock.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@proinserco.test' } },
      error: null,
    })
    authMock.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    authMock.getClaims.mockResolvedValue({
      data: {
        claims: { sub: USER_ID, app_metadata: { rol: 'administrador' }, exp: Math.floor(AHORA.getTime() / 1000) + 36_000 },
      },
      error: null,
    })
    authMock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: [] },
      error: null,
    })

    await provider.iniciarSesion({ correo: 'admin@proinserco.test', contrasena: 'clave-muy-larga-123' }, cookies, { ip: null })
    await provider.verificarSegundoFactor('123456', cookies)

    // Avanza en pasos de 20 minutos (sin superar 30 min de inactividad) hasta pasar 8 horas absolutas
    for (let i = 0; i < 24; i++) {
      reloj.avanzar(20 * 60_000)
      expect(await provider.obtenerIdentidad(cookies)).not.toBeNull()
    }
    reloj.avanzar(5 * 60_000) // 8h 05m
    expect(await provider.obtenerIdentidad(cookies)).toBeNull()
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(cookies.mapa.has('__Host-proinserco_actividad')).toBe(false)

    // Si alguien elimina la cookie de actividad en una sesión aal2 -> falla cerrado
    authMock.signOut.mockClear()
    expect(await provider.obtenerIdentidad(cookies)).toBeNull()
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
