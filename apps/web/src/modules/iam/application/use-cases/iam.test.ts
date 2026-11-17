import { describe, expect, it } from 'vitest'
import { crearListarAuditoria } from '@/modules/auditoria/application/use-cases/listar-auditoria'
import { crearRegistrarAuditoria } from '@/modules/auditoria/application/use-cases/registrar-auditoria'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'
import { AHORA, actorDe, crearIdsSecuenciales } from '@/test/mundo-memoria'
import { CodigoMfaInvalido, CredencialesInvalidas, DesafioMfaExpirado } from '../../domain/errores'
import { RutaSiguiente } from '../../domain/esquemas'
import { crearIdentityProviderMemoria } from '../../infrastructure/identity-provider-memoria'
import { generarTotp } from '../../infrastructure/totp'
import { USUARIOS_DEMO } from '../../infrastructure/usuarios-demo'
import type { AlmacenCookies } from '../ports/almacen-cookies'
import { crearCerrarSesion } from './cerrar-sesion'
import { crearIniciarSesion } from './iniciar-sesion'
import { crearObtenerActor } from './obtener-actor'
import { crearVerificarSegundoFactor } from './verificar-segundo-factor'

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

const [ADMIN] = USUARIOS_DEMO
if (!ADMIN) throw new Error('Faltan usuarios demo')

function crearIam() {
  const reloj = crearRelojFijo(AHORA)
  const ids = crearIdsSecuenciales()
  const registro = crearRegistroAuditoriaMemoria()
  const auditor = { registrar: crearRegistrarAuditoria({ registro, reloj, ids }) }
  const identidad = crearIdentityProviderMemoria(USUARIOS_DEMO, reloj, {
    secreto: 'x'.repeat(40),
    cookiesSeguras: true,
    nombreCookieSesion: '__Host-sesion',
    nombreCookieDesafio: '__Host-mfa',
    inactividadMinutos: 30,
    duracionMaximaHoras: 8,
  })
  return {
    reloj,
    listarAuditoria: crearListarAuditoria({ registro }),
    iniciarSesion: crearIniciarSesion({ identidad, auditor }),
    verificar: crearVerificarSegundoFactor({ identidad, auditor }),
    cerrarSesion: crearCerrarSesion({ identidad, auditor }),
    obtenerActor: crearObtenerActor({ identidad }),
  }
}

const credenciales = { correo: ADMIN.correo, contrasena: ADMIN.contrasena }

describe('inicio de sesión con segundo factor', () => {
  it('flujo completo: contraseña → TOTP → actor aal2 con permisos', async () => {
    const iam = crearIam()
    const cookies = crearCookies()
    await iam.iniciarSesion(credenciales, cookies, '192.0.2.1')
    expect(await iam.obtenerActor(cookies)).toBeNull() // solo aal1: aún no es actor
    await iam.verificar({ codigo: generarTotp(ADMIN.secretoTotp, iam.reloj.ahora()) }, cookies, null)
    const actor = await iam.obtenerActor(cookies)
    expect(actor?.nivel).toBe('aal2')
    expect(actor?.puede('donantes:revelar')).toBe(true)
    expect(cookies.mapa.has('__Host-mfa')).toBe(false)
  })

  it('contraseña incorrecta y correo inexistente dan el mismo error y quedan auditados', async () => {
    const iam = crearIam()
    await expect(iam.iniciarSesion({ ...credenciales, contrasena: 'incorrecta-123' }, crearCookies(), null)).rejects.toThrow(
      CredencialesInvalidas,
    )
    await expect(
      iam.iniciarSesion({ correo: 'nadie@demo.test', contrasena: 'incorrecta-123' }, crearCookies(), null),
    ).rejects.toThrow(CredencialesInvalidas)
    const fallos = await iam.listarAuditoria({ accion: 'sesion.fallida' }, {}, actorDe('administrador'))
    expect(fallos.total).toBe(2)
  })

  it('rechaza un código TOTP incorrecto y uno reutilizado', async () => {
    const iam = crearIam()
    const cookies = crearCookies()
    await iam.iniciarSesion(credenciales, cookies, null)
    await expect(iam.verificar({ codigo: '000000' }, cookies, null)).rejects.toThrow(CodigoMfaInvalido)
    const codigo = generarTotp(ADMIN.secretoTotp, iam.reloj.ahora())
    await iam.verificar({ codigo }, cookies, null)

    const otra = crearCookies()
    await iam.iniciarSesion(credenciales, otra, null)
    await expect(iam.verificar({ codigo }, otra, null)).rejects.toThrow(CodigoMfaInvalido)
  })

  it('el desafío MFA caduca a los 5 minutos', async () => {
    const iam = crearIam()
    const cookies = crearCookies()
    await iam.iniciarSesion(credenciales, cookies, null)
    iam.reloj.avanzar(6 * 60_000)
    await expect(iam.verificar({ codigo: generarTotp(ADMIN.secretoTotp, iam.reloj.ahora()) }, cookies, null)).rejects.toThrow(
      DesafioMfaExpirado,
    )
  })

  it('una cookie de sesión manipulada no autentica', async () => {
    const iam = crearIam()
    const cookies = crearCookies()
    await iam.iniciarSesion(credenciales, cookies, null)
    await iam.verificar({ codigo: generarTotp(ADMIN.secretoTotp, iam.reloj.ahora()) }, cookies, null)
    const valor = cookies.mapa.get('__Host-sesion') ?? ''
    cookies.mapa.set('__Host-sesion', `x${valor.slice(1)}`)
    expect(await iam.obtenerActor(cookies)).toBeNull()
  })

  it('la sesión expira por inactividad y al cerrar sesión se revoca en servidor', async () => {
    const iam = crearIam()
    const cookies = crearCookies()
    await iam.iniciarSesion(credenciales, cookies, null)
    await iam.verificar({ codigo: generarTotp(ADMIN.secretoTotp, iam.reloj.ahora()) }, cookies, null)
    const robada = cookies.mapa.get('__Host-sesion') ?? ''
    await iam.cerrarSesion(cookies, null)
    const copia = crearCookies()
    copia.mapa.set('__Host-sesion', robada)
    expect(await iam.obtenerActor(copia)).toBeNull()

    const otra = crearCookies()
    iam.reloj.avanzar(60_000)
    await iam.iniciarSesion(credenciales, otra, null)
    await iam.verificar({ codigo: generarTotp(ADMIN.secretoTotp, iam.reloj.ahora()) }, otra, null)
    iam.reloj.avanzar(31 * 60_000)
    expect(await iam.obtenerActor(otra)).toBeNull()
  })

  it('la ruta siguiente solo admite rutas del panel (sin open redirect)', () => {
    expect(RutaSiguiente.parse('/panel/donaciones?estado=aprobada')).toBe('/panel/donaciones?estado=aprobada')
    expect(RutaSiguiente.parse('https://malo.test')).toBe('/panel')
    expect(RutaSiguiente.parse('//malo.test')).toBe('/panel')
    expect(RutaSiguiente.parse(undefined)).toBe('/panel')
  })
})
