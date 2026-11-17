import { ErrorDeDominio } from '@/shared/domain/errores'
import type { EstadoDonacion } from './estado-donacion'

export class TransicionInvalida extends ErrorDeDominio {
  readonly code = 'TRANSICION_INVALIDA'
  constructor(
    readonly desde: EstadoDonacion,
    readonly hacia: EstadoDonacion,
  ) {
    super(`No se puede pasar de ${desde} a ${hacia}`)
  }
}

export class MontoFueraDeRango extends ErrorDeDominio {
  readonly code = 'MONTO_FUERA_DE_RANGO'
  override readonly esPublico = true
  constructor(
    readonly minimoPesos: number,
    readonly maximoPesos: number,
  ) {
    super(`El monto debe estar entre ${minimoPesos} y ${maximoPesos} pesos`)
  }
}

export class DonacionesDeshabilitadas extends ErrorDeDominio {
  readonly code = 'DONACIONES_DESHABILITADAS'
  override readonly esPublico = true
  constructor() {
    super('Las donaciones en línea están pausadas en este momento. Inténtalo más tarde')
  }
}

/** La misma clave de idempotencia ya produjo una donación que no admite reintento. */
export class DonacionYaProcesada extends ErrorDeDominio {
  readonly code = 'DONACION_YA_PROCESADA'
  override readonly esPublico = true
  constructor() {
    super('Esta donación ya se procesó. Revisa tu correo o vuelve a empezar')
  }
}

export class PasarelaNoDisponible extends ErrorDeDominio {
  readonly code = 'PASARELA_NO_DISPONIBLE'
  override readonly esPublico = true
  /** `causa` se conserva para el registro del servidor; nunca sale al cliente. */
  constructor(causa?: unknown) {
    super('No pudimos conectar con la pasarela de pagos. Inténtalo de nuevo en unos minutos')
    this.cause = causa
  }
}
