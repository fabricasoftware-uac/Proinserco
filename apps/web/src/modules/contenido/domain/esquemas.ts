import { z } from 'zod'

/**
 * Forma del contenido del sitio. Los datos viven en ../datos/ y se validan
 * contra estos esquemas en un test: un texto vacío o un campo olvidado
 * rompe CI, no la página.
 *
 * Marcador `TODO-CONTENIDO`: dato que falta o que el cliente debe confirmar.
 * Nunca se rellena con datos inventados (especificación del sitio).
 */
const Texto = z.string().trim().min(1)
const RutaPublica = z.string().regex(/^\/[\w\-/.]+$/)

export const Imagen = z.object({ src: RutaPublica, ancho: z.number().int().positive(), alto: z.number().int().positive() })

export const Organizacion = z.object({
  nombre: Texto,
  nombreCorto: Texto,
  lema: Texto,
  aniosExperiencia: z.number().int().positive(),
  descripcionCorta: Texto,
  /** NIT, RTE, razón social: no constan en ninguna fuente. */
  nit: z.literal('TODO-CONTENIDO'),
})

export const Contacto = z.object({
  telefono: Texto,
  /** Enlace de WhatsApp del mismo número: es el que usa el sitio al pulsar el teléfono. */
  whatsapp: z.url().regex(/^https:\/\/wa\.me\/\d{10,13}(\?text=[\w%.-]+)?$/),
  direccion: Texto,
  barrio: Texto,
  ciudad: Texto,
  departamento: Texto,
  pais: Texto,
  correo: z.union([z.email(), z.literal('TODO-CONTENIDO')]),
  redes: z.array(z.object({ red: Texto, url: z.url() })),
})

export const Cifra = z.object({ valor: z.number().int().nonnegative(), etiqueta: Texto, detalle: Texto.optional() })

export const QuienesSomos = z.object({
  titulo: Texto,
  parrafos: z.array(Texto).min(1),
  /** Palabras a resaltar en la animación de revelado (deben aparecer en los párrafos). */
  resaltadas: z.array(Texto),
  cifra: Cifra,
})

export const MisionVision = z.object({ mision: Texto, vision: z.array(Texto).min(1) })

export const ItemQueHacemos = z.object({ id: Texto, titulo: Texto, nota: Texto.optional() })

export const BloqueProceso = z.object({ titulo: Texto, puntos: z.array(Texto).min(1) })

export const SectorCapacitacion = z.enum(['educacion', 'salud', 'agricola'])
export const Capacitacion = z.object({
  sector: SectorCapacitacion,
  titulo: Texto,
  puntos: z.array(Texto).min(1),
  destacado: z.object({ valor: z.number().int(), etiqueta: Texto, meta: z.number().int().optional() }).optional(),
  nota: Texto.optional(),
})

export const Municipio = z.object({
  nombre: Texto,
  departamento: Texto,
  /** false = inferido del mapa del PPTX, sin confirmar con el cliente. */
  confirmado: z.boolean(),
})

export const Aliado = z.object({ id: Texto, nombre: Texto, logo: Imagen, nota: Texto.optional() })

export const MiembroEquipo = z.object({
  id: Texto,
  nombre: Texto,
  rol: Texto,
  descripcion: Texto.optional(),
  foto: Imagen,
})

export const ContenidoSitio = z.object({
  organizacion: Organizacion,
  contacto: Contacto,
  quienesSomos: QuienesSomos,
  misionVision: MisionVision,
  queHacemos: z.object({ titulo: Texto, items: z.array(ItemQueHacemos).length(6) }),
  comoTrabajamos: z.object({ titulo: Texto, elaboracion: BloqueProceso, ejecucion: BloqueProceso }),
  capacitaciones: z.object({ titulo: Texto, sectores: z.array(Capacitacion).length(3) }),
  territorio: z.object({ titulo: Texto, departamento: Texto, municipios: z.array(Municipio).min(1) }),
  aliados: z.object({ titulo: Texto, lista: z.array(Aliado).min(1), nota: Texto }),
  valores: z.object({ titulo: Texto, lista: z.array(Texto).min(1) }),
  principios: z.object({ titulo: Texto, lista: z.array(Texto).min(1) }),
  equipo: z.object({ titulo: Texto, introduccion: Texto, cierre: Texto, miembros: z.array(MiembroEquipo).min(1) }),
  donar: z.object({
    titulo: Texto,
    llamado: Texto,
    /** Sugerencias de la interfaz; el rango permitido lo valida el servidor (env). */
    montosSugeridosPesos: z.array(z.number().int().positive()).min(1),
    nota: Texto,
  }),
  cierre: Texto,
  legal: z.object({
    versionPoliticaDatos: Texto,
    estado: z.literal('borrador'),
    aviso: Texto,
  }),
  creditos: z.array(z.object({ texto: Texto, url: z.url() })).min(1),
})
export type ContenidoSitio = z.infer<typeof ContenidoSitio>
