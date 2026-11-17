/**
 * Errores tipados de dominio. El `code` es lo que el borde (acciones, route
 * handlers) traduce a una respuesta; el `message` nunca sale tal cual al
 * cliente salvo en los errores marcados como `esPublico`.
 */
export abstract class ErrorDeDominio extends Error {
  abstract readonly code: string
  /** Si es true, el mensaje se puede mostrar al usuario final. */
  readonly esPublico: boolean = false

  constructor(mensaje?: string) {
    super(mensaje)
    this.name = new.target.name
  }
}

export class NoAutenticado extends ErrorDeDominio {
  readonly code = 'NO_AUTENTICADO'
  override readonly esPublico = true
  constructor() {
    super('Debes iniciar sesión')
  }
}

/** Sin permiso. El borde lo responde como NO_ENCONTRADO para no confirmar existencia. */
export class NoAutorizado extends ErrorDeDominio {
  readonly code = 'NO_AUTORIZADO'
  constructor(readonly permiso?: string) {
    super(permiso ? `Falta el permiso ${permiso}` : 'No autorizado')
  }
}

export class NoEncontrado extends ErrorDeDominio {
  readonly code = 'NO_ENCONTRADO'
  override readonly esPublico = true
  constructor() {
    super('No encontramos lo que buscas')
  }
}

export class DemasiadasPeticiones extends ErrorDeDominio {
  readonly code = 'DEMASIADAS_PETICIONES'
  override readonly esPublico = true
  constructor(readonly reintentarEnSegundos: number) {
    super('Demasiados intentos. Espera un momento y vuelve a intentarlo')
  }
}

export class VerificacionAntiBotsFallida extends ErrorDeDominio {
  readonly code = 'VERIFICACION_ANTIBOTS_FALLIDA'
  override readonly esPublico = true
  constructor() {
    super('No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo')
  }
}

export class ServicioNoDisponible extends ErrorDeDominio {
  readonly code = 'SERVICIO_NO_DISPONIBLE'
  override readonly esPublico = true
  constructor(mensaje = 'El servicio no está disponible en este momento') {
    super(mensaje)
  }
}

/** Un adaptador real que aún no está escrito. Nunca debe llegar a producción. */
export class NoImplementado extends ErrorDeDominio {
  readonly code = 'NO_IMPLEMENTADO'
  constructor(readonly que: string) {
    super(`No implementado: ${que}`)
  }
}
