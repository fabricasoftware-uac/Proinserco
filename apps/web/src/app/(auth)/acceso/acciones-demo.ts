'use server'

import { z } from 'zod'
import { accionPublica, conLimiteDeTasa } from '@/server/acciones'
import { NoEncontrado } from '@/shared/domain/errores'
import { codigoTotpDemo, demoActivo } from './demo'

/**
 * SOLO DEMOSTRACIÓN: devuelve el código TOTP vigente de un usuario demo para quien no tiene
 * una app autenticadora a mano. Fuera del modo memoria o en producción responde 404.
 * El segundo factor sigue verificándose igual (código real, anti-repetición y límites).
 */
export const codigoDemoAccion = accionPublica
  .metadata({ nombre: 'codigo-demo' })
  .use(conLimiteDeTasa({ limite: 20, ventanaSegundos: 300 }))
  .inputSchema(z.strictObject({ correo: z.string().max(254) }))
  .action(async ({ parsedInput }) => {
    if (!(await demoActivo())) throw new NoEncontrado()
    const codigo = codigoTotpDemo(parsedInput.correo.toLowerCase(), new Date())
    if (!codigo) throw new NoEncontrado()
    return { codigo }
  })
