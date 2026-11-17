/** Barrel público del módulo iam. */

export type { AlmacenCookies, OpcionesCookie } from './application/ports/almacen-cookies'
export { CodigoMfaInvalido, CredencialesInvalidas, DesafioMfaExpirado } from './domain/errores'
export { CodigoMfa, Credenciales, RutaSiguiente } from './domain/esquemas'
export type { Identidad } from './domain/identidad'
export { PERMISOS_POR_ROL, Rol } from './domain/roles'
