import { z } from 'zod'

export const TipoDocumento = z.enum(['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'])
export type TipoDocumento = z.infer<typeof TipoDocumento>

export const NOMBRES_TIPO_DOCUMENTO: Readonly<Record<TipoDocumento, string>> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  PA: 'Pasaporte',
  PPT: 'Permiso por protección temporal',
  NIT: 'NIT',
}

const SoloLetras = /^[\p{L}][\p{L}' .-]*$/u

/**
 * Datos del donante (paso 2 del formulario). El MISMO esquema valida en el
 * navegador (zodResolver) y en el servidor. Toda cadena con tope.
 */
export const DatosDonante = z.strictObject({
  nombres: z.string().trim().min(2).max(80).regex(SoloLetras, 'Usa solo letras'),
  apellidos: z.string().trim().min(2).max(80).regex(SoloLetras, 'Usa solo letras'),
  tipoDocumento: TipoDocumento,
  numeroDocumento: z
    .string()
    .trim()
    .transform((v) => v.replace(/[.\s]/g, ''))
    .pipe(z.string().regex(/^[0-9A-Za-z-]{4,20}$/, 'Número de documento no válido')),
  correo: z
    .email('Correo no válido')
    .max(254)
    .transform((v) => v.toLowerCase()),
  /** Celular colombiano (3XXXXXXXXX → +573XXXXXXXXX) o teléfono internacional en formato E.164 (+<código><número>). */
  celular: z
    .string()
    .trim()
    .transform((v) => {
      const limpio = v.replace(/[\s().-]/g, '')
      if (limpio.startsWith('+')) return limpio
      if (/^573\d{9}$/.test(limpio)) return `+${limpio}`
      if (/^3\d{9}$/.test(limpio)) return `+57${limpio}`
      return limpio
    })
    .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, 'Celular colombiano de 10 dígitos o teléfono internacional con +código')),
})
export type DatosDonante = z.infer<typeof DatosDonante>
export type DatosDonanteEntrada = z.input<typeof DatosDonante>

export type DonanteId = string & { readonly __marca: 'DonanteId' }

export type Donante = Readonly<
  DatosDonante & {
    id: DonanteId
    quiereCertificado: boolean
    creadoEn: Date
    actualizadoEn: Date
  }
>
