import { ErrorDeDominio } from '@/shared/domain/errores'

/** Mismo mensaje exista o no el correo: no se enumeran usuarios. */
export class CredencialesInvalidas extends ErrorDeDominio {
  readonly code = 'CREDENCIALES_INVALIDAS'
  override readonly esPublico = true
  constructor() {
    super('Correo o contraseña incorrectos')
  }
}

export class CodigoMfaInvalido extends ErrorDeDominio {
  readonly code = 'CODIGO_MFA_INVALIDO'
  override readonly esPublico = true
  constructor() {
    super('El código no es válido o ya se usó')
  }
}

export class DesafioMfaExpirado extends ErrorDeDominio {
  readonly code = 'DESAFIO_MFA_EXPIRADO'
  override readonly esPublico = true
  constructor() {
    super('Tu intento de inicio de sesión caducó. Vuelve a escribir tu correo y contraseña')
  }
}
