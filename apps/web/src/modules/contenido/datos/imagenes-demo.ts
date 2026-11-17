import '@/shared/lib/zod-sin-eval'
import { z } from 'zod'
import manifiesto from '../../../../public/img/demo/manifiesto.json'

/**
 * Fotos de DEMOSTRACIÓN (Pexels) revisadas a mano. El cliente las sustituirá.
 * Fuente: public/img/demo/manifiesto.json (lo genera scripts/pexels.mjs).
 * `src` es la ruta pública para <Image src>; crédito al autor en `autor`/`url`.
 */
const EntradaManifiesto = z.object({
  archivo: z.string().regex(/^[\w-]+\.jpg$/),
  sección: z.enum(['hero', 'agricola', 'educacion', 'salud', 'territorio', 'comunidad']),
  alt: z.string().min(1),
  autor: z.string(),
  url: z.url(),
  ancho: z.number().int().positive(),
  alto: z.number().int().positive(),
})

export type ImagenDemo = Readonly<{
  src: string
  seccion: z.infer<typeof EntradaManifiesto>['sección']
  alt: string
  autor: string
  url: string
  ancho: number
  alto: number
}>

export const IMAGENES_DEMO: readonly ImagenDemo[] = z
  .array(EntradaManifiesto)
  .parse(manifiesto)
  .map((e) => ({
    src: `/img/demo/${e.archivo}`,
    seccion: e.sección,
    alt: e.alt,
    autor: e.autor,
    url: e.url,
    ancho: e.ancho,
    alto: e.alto,
  }))

export function imagenesDe(seccion: ImagenDemo['seccion']): readonly ImagenDemo[] {
  return IMAGENES_DEMO.filter((i) => i.seccion === seccion)
}
