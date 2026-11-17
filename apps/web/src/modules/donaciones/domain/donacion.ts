import type { Importe } from '@/shared/domain/importe'
import { TransicionInvalida } from './errores'
import { type EstadoDonacion, esTransicionValida, type OrigenTransicion } from './estado-donacion'
import type { LineaApoyo } from './linea-apoyo'

export type DonacionId = string & { readonly __marca: 'DonacionId' }

export type TransicionRegistrada = Readonly<{
  desde: EstadoDonacion
  hacia: EstadoDonacion
  en: Date
  origen: OrigenTransicion
}>

/** Instantánea del pagador que necesita la pasarela. El donante completo vive en su módulo. */
export type Pagador = Readonly<{ nombres: string; apellidos: string; correo: string }>

export type DatosDonacion = Readonly<{
  id: DonacionId
  /** Nuestra referencia única (order_id en la pasarela). Pública pero imposible de adivinar. */
  referencia: string
  claveIdempotencia: string
  estado: EstadoDonacion
  importe: Importe
  linea: LineaApoyo
  donanteId: string
  pagador: Pagador
  quiereCertificado: boolean
  idCargo: string | null
  urlPago: string | null
  metodoPago: string | null
  creadaEn: Date
  actualizadaEn: Date
  historial: readonly TransicionRegistrada[]
}>

/** Entidad inmutable: cada transición devuelve una donación nueva. */
export class Donacion {
  private constructor(readonly datos: DatosDonacion) {}

  static crear(
    entrada: Pick<
      DatosDonacion,
      'id' | 'referencia' | 'claveIdempotencia' | 'importe' | 'linea' | 'donanteId' | 'pagador' | 'quiereCertificado'
    >,
    ahora: Date,
  ): Donacion {
    if (entrada.importe.centavos <= 0n) throw new RangeError('El importe debe ser positivo')
    return new Donacion({
      ...entrada,
      estado: 'creada',
      idCargo: null,
      urlPago: null,
      metodoPago: null,
      creadaEn: ahora,
      actualizadaEn: ahora,
      historial: [],
    })
  }

  /** Para adaptadores de persistencia (mapper aDominio). */
  static reconstruir(datos: DatosDonacion): Donacion {
    return new Donacion(datos)
  }

  get id(): DonacionId {
    return this.datos.id
  }

  get estado(): EstadoDonacion {
    return this.datos.estado
  }

  /** La pasarela creó el cargo: queda pendiente de pago. */
  registrarCargo(idCargo: string, urlPago: string, ahora: Date): Donacion {
    return this.transicionar('pendiente', ahora, 'servidor', { idCargo, urlPago })
  }

  transicionar(
    hacia: EstadoDonacion,
    ahora: Date,
    origen: OrigenTransicion,
    cambios: Partial<Pick<DatosDonacion, 'idCargo' | 'urlPago' | 'metodoPago'>> = {},
  ): Donacion {
    const desde = this.datos.estado
    if (!esTransicionValida(desde, hacia)) throw new TransicionInvalida(desde, hacia)
    return new Donacion({
      ...this.datos,
      ...cambios,
      estado: hacia,
      actualizadaEn: ahora,
      historial: [...this.datos.historial, { desde, hacia, en: ahora, origen }],
    })
  }
}
