'use server'

import { z } from 'zod'
import { accionPanel, conLimiteDeTasa, conPermiso } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { contextoPeticion } from '@/server/contexto-peticion'
import { CampoRevelable } from '../application/use-cases/obtener-donante'

/**
 * "Revelar" un dato personal enmascarado. Permiso `donantes:revelar` (el caso de uso
 * lo exige otra vez) + limite de frecuencia; SIEMPRE queda en la auditoria, sin el valor.
 */
export const revelarDatoDonanteAccion = accionPanel
  .metadata({ nombre: 'revelar-dato-donante' })
  .use(conPermiso('donantes:revelar'))
  .use(conLimiteDeTasa({ limite: 30, ventanaSegundos: 300 }))
  .inputSchema(z.strictObject({ donanteId: z.string().min(1).max(80), campo: CampoRevelable }))
  .action(async ({ parsedInput, ctx: { actor } }) => {
    const { donantes } = await obtenerContenedor()
    const { ip } = await contextoPeticion()
    const valor = await donantes.revelarDatoDonante(parsedInput.donanteId, parsedInput.campo, actor, ip)
    return { valor }
  })
