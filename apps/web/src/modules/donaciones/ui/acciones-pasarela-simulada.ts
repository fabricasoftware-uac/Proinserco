'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { accionPublica, conLimiteDeTasa } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { NoEncontrado } from '@/shared/domain/errores'

const Decision = z.strictObject({
  idCargo: z.string().regex(/^sim_[a-f0-9]{32}$/),
  resultado: z.enum(['aprobado', 'rechazado']),
})

/**
 * SOLO ENTORNO DE PRUEBAS (ADAPTADORES=memoria). Hace de "pagador" en la
 * pasarela simulada y después de "webhook": la donación cambia de estado
 * por la conciliación (consulta a la pasarela), exactamente como lo hará
 * con Openpay. El retorno a /donar/resultado NO confirma nada por sí solo.
 */
export const resolverPasarelaSimuladaAccion = accionPublica
  .metadata({ nombre: 'pasarela-simulada' })
  .use(conLimiteDeTasa({ limite: 20, ventanaSegundos: 600 }))
  .inputSchema(Decision)
  .action(async ({ parsedInput }) => {
    const { pasarelaSimulada, donaciones } = await obtenerContenedor()
    if (!pasarelaSimulada) throw new NoEncontrado()
    const urlRetorno = pasarelaSimulada.resolverCargo(parsedInput.idCargo, parsedInput.resultado)
    // Simula el webhook de la pasarela: un aviso que dispara la consulta.
    await donaciones.conciliarDonacion({ idCargo: parsedInput.idCargo }, 'webhook')
    redirect(urlRetorno)
  })
