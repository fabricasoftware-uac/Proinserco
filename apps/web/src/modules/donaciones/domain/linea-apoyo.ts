import { z } from 'zod'

/**
 * A qué línea de la fundación apoya la donación (opcional en el formulario).
 * Salen de las capacitaciones por sector del contenido fuente.
 */
export const LineaApoyo = z.enum(['donde-mas-se-necesite', 'educacion', 'salud', 'agricola'])
export type LineaApoyo = z.infer<typeof LineaApoyo>
