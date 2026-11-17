import { ErrorDeDominio } from '@/shared/domain/errores'

export class DatosDonanteInvalidos extends ErrorDeDominio {
  readonly code = 'DATOS_DONANTE_INVALIDOS'
  override readonly esPublico = true
  constructor() {
    super('Revisa tus datos: hay campos que no son válidos')
  }
}
