'use server'

import { z } from 'zod'
import { accionPanel, conLimiteDeTasa, conPermiso } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { contextoPeticion } from '@/server/contexto-peticion'
import { consultarParaExportar } from './consulta-panel'
import { documentoCsv } from './csv'

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Los mismos filtros que la URL del listado, validados otra vez en el servidor. */
const EntradaExportacion = z.strictObject({
  estado: z.string().max(20).optional(),
  linea: z.string().max(40).optional(),
  q: z.string().trim().max(100).optional(),
  desde: Fecha.optional(),
  hasta: Fecha.optional(),
  minPesos: z.number().int().min(0).max(1e12).optional(),
  maxPesos: z.number().int().min(0).max(1e12).optional(),
  orden: z.enum(['fecha', 'monto', 'estado']).default('fecha'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

const ENCABEZADOS = ['Referencia', 'Fecha (UTC)', 'Estado', 'Monto COP', 'Línea de apoyo', 'Donante', 'Correo (enmascarado)']

/**
 * Exporta a CSV lo FILTRADO. Permiso `donaciones:exportar`, limite de frecuencia y
 * registro en la auditoria (cuantas filas y con que filtros, sin datos personales).
 * Los datos personales salen enmascarados; las celdas se neutralizan contra formulas.
 */
export const exportarDonacionesAccion = accionPanel
  .metadata({ nombre: 'exportar-donaciones' })
  .use(conPermiso('donaciones:exportar'))
  .use(conLimiteDeTasa({ limite: 5, ventanaSegundos: 300 }))
  .inputSchema(EntradaExportacion)
  .action(async ({ parsedInput, ctx: { actor } }) => {
    const c = await obtenerContenedor()
    const { ip } = await contextoPeticion()
    const { minPesos, maxPesos, ...resto } = parsedInput
    const { filas, truncado } = await consultarParaExportar(c.donaciones.listarDonaciones, actor, {
      ...resto,
      minPesos,
      maxPesos,
      pagina: 1,
      limite: 100,
    })
    const csv = documentoCsv(
      ENCABEZADOS,
      filas.map((f) => [f.referencia, f.creadaEn, f.estado, f.montoPesos, f.linea, f.donante, f.correoEnmascarado]),
    )
    await c.transversal.auditor.registrar({
      accion: 'donaciones.exportadas',
      actorId: actor.usuarioId,
      recurso: 'donaciones',
      recursoId: null,
      ip,
      detalles: {
        filas: filas.length,
        truncado,
        ...(parsedInput.estado ? { estado: parsedInput.estado } : {}),
        ...(parsedInput.linea ? { linea: parsedInput.linea } : {}),
        ...(parsedInput.desde ? { desde: parsedInput.desde } : {}),
        ...(parsedInput.hasta ? { hasta: parsedInput.hasta } : {}),
        ...(minPesos !== undefined ? { minPesos } : {}),
        ...(maxPesos !== undefined ? { maxPesos } : {}),
        // El texto de busqueda puede ser un correo: solo se registra que habia busqueda.
        conBusqueda: Boolean(parsedInput.q),
      },
    })
    const sello = new Date().toISOString().slice(0, 10)
    return { nombreArchivo: `donaciones-${sello}.csv`, csv, filas: filas.length, truncado }
  })
