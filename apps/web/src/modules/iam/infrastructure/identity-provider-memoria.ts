import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Reloj } from '@/shared/application/ports/reloj'
import type { AlmacenCookies, OpcionesCookie } from '../application/ports/almacen-cookies'
import type { IdentityProvider } from '../application/ports/identity-provider'
import { CodigoMfaInvalido, CredencialesInvalidas, DesafioMfaExpirado } from '../domain/errores'
import type { Identidad } from '../domain/identidad'
import type { Rol } from '../domain/roles'
import { crearFirmador } from './firma-tokens'
import { verificarTotp } from './totp'

export type UsuarioMemoria = Readonly<{
  id: string
  correo: string
  nombre: string
  rol: Rol
  contrasena: string
  secretoTotp: string
}>

export type ConfiguracionIdentidadMemoria = Readonly<{
  secreto: string
  /** true en HTTPS: cookies `Secure` y prefijo `__Host-`. */
  cookiesSeguras: boolean
  nombreCookieSesion: string
  nombreCookieDesafio: string
  /** Inactividad máxima antes de expirar (min). */
  inactividadMinutos: number
  /** Duración absoluta máxima de una sesión (h). */
  duracionMaximaHoras: number
}>

type UsuarioInterno = UsuarioMemoria & { sal: Buffer; hash: Buffer }
type Sesion = { usuarioId: string; creadaEn: number; ultimoUso: number }

const DESAFIO_MINUTOS = 5

/**
 * IdentityProvider EN MEMORIA (pruebas unitarias y arranque local sin usuarios).
 * Implementa lo que importa para la seguridad:
 *  - contraseñas con scrypt y comparación en tiempo constante;
 *  - MFA TOTP real (RFC 6238) con anti-replay;
 *  - sesión con id aleatorio de 256 bits, guardada en servidor (revocable),
 *    cookie firmada HttpOnly + SameSite=Strict (+ Secure/__Host- en HTTPS);
 *  - caducidad por inactividad y absoluta.
 */
export function crearIdentityProviderMemoria(
  usuarios: readonly UsuarioMemoria[],
  reloj: Reloj,
  config: ConfiguracionIdentidadMemoria,
): IdentityProvider {
  const firmador = crearFirmador(config.secreto)
  const internos: UsuarioInterno[] = usuarios.map((u) => {
    const sal = randomBytes(16)
    return { ...u, sal, hash: scryptSync(u.contrasena, sal, 32) }
  })
  const salFicticia = randomBytes(16)
  const sesiones = new Map<string, Sesion>()
  const ultimoContadorTotp = new Map<string, number>()

  const opciones = (maxAgeSegundos?: number): OpcionesCookie => ({
    httpOnly: true,
    secure: config.cookiesSeguras,
    sameSite: 'strict',
    path: '/',
    ...(maxAgeSegundos ? { maxAgeSegundos } : {}),
  })

  function leerDesafio(cookies: AlmacenCookies): string | null {
    const carga = firmador.verificar(cookies.obtener(config.nombreCookieDesafio))
    if (!carga) return null
    const [usuarioId, expira] = carga.split('|')
    if (!usuarioId || Number(expira) < reloj.ahora().getTime()) return null
    return usuarioId
  }

  function sesionVigente(id: string): Sesion | null {
    const sesion = sesiones.get(id)
    if (!sesion) return null
    const ahora = reloj.ahora().getTime()
    const inactiva = ahora - sesion.ultimoUso > config.inactividadMinutos * 60_000
    const vencida = ahora - sesion.creadaEn > config.duracionMaximaHoras * 3_600_000
    if (inactiva || vencida) {
      sesiones.delete(id)
      return null
    }
    return sesion
  }

  function identidadDe(usuario: UsuarioInterno, sesion: Sesion): Identidad {
    const expiraPorInactividad = sesion.ultimoUso + config.inactividadMinutos * 60_000
    const expiraAbsoluta = sesion.creadaEn + config.duracionMaximaHoras * 3_600_000
    return {
      usuarioId: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.rol,
      nivel: 'aal2',
      expiraEn: new Date(Math.min(expiraPorInactividad, expiraAbsoluta)),
    }
  }

  return {
    async iniciarSesion({ correo, contrasena }, cookies) {
      const usuario = internos.find((u) => u.correo === correo)
      // Se calcula el hash aunque el usuario no exista: el tiempo de respuesta no lo delata.
      const hash = scryptSync(contrasena, usuario?.sal ?? salFicticia, 32)
      if (!usuario || !timingSafeEqual(hash, usuario.hash)) throw new CredencialesInvalidas()
      const expira = reloj.ahora().getTime() + DESAFIO_MINUTOS * 60_000
      const carga = `${usuario.id}|${expira}|${randomBytes(8).toString('base64url')}`
      cookies.establecer(config.nombreCookieDesafio, firmador.firmar(carga), opciones(DESAFIO_MINUTOS * 60))
      return { usuarioId: usuario.id }
    },

    async desafioPendiente(cookies) {
      return leerDesafio(cookies)
    },

    async verificarSegundoFactor(codigo, cookies) {
      const usuarioId = leerDesafio(cookies)
      if (!usuarioId) throw new DesafioMfaExpirado()
      const usuario = internos.find((u) => u.id === usuarioId)
      if (!usuario) throw new DesafioMfaExpirado()
      const contador = verificarTotp(usuario.secretoTotp, codigo, reloj.ahora(), ultimoContadorTotp.get(usuario.id) ?? -1)
      if (contador === null) throw new CodigoMfaInvalido()
      ultimoContadorTotp.set(usuario.id, contador)

      const id = randomBytes(32).toString('base64url')
      const ahora = reloj.ahora().getTime()
      const sesion: Sesion = { usuarioId: usuario.id, creadaEn: ahora, ultimoUso: ahora }
      sesiones.set(id, sesion)
      cookies.eliminar(config.nombreCookieDesafio)
      cookies.establecer(config.nombreCookieSesion, firmador.firmar(id), opciones(config.duracionMaximaHoras * 3600))
      return identidadDe(usuario, sesion)
    },

    async obtenerIdentidad(cookies) {
      const id = firmador.verificar(cookies.obtener(config.nombreCookieSesion))
      if (!id) return null
      const sesion = sesionVigente(id)
      if (!sesion) return null
      const usuario = internos.find((u) => u.id === sesion.usuarioId)
      if (!usuario) return null
      sesion.ultimoUso = reloj.ahora().getTime()
      return identidadDe(usuario, sesion)
    },

    async cerrarSesion(cookies) {
      const id = firmador.verificar(cookies.obtener(config.nombreCookieSesion))
      if (id) sesiones.delete(id)
      cookies.eliminar(config.nombreCookieSesion)
      cookies.eliminar(config.nombreCookieDesafio)
    },
  }
}
