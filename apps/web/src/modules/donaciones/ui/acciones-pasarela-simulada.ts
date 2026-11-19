'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { accionPublica, conLimiteDeTasa } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { NoEncontrado } from '@/shared/domain/errores'

const Decision = z.strictObject({
  idCargo: z.string().regex(/^sim_[a-f0-9]{32}$/),
  resultado: z.enum(['aprobado', 'rechazado']),
})

/**
 * SOLO ENTORNO DE PRUEBAS (ADAPTADORES=memoria y NODE_ENV distinto de production;
 * en cualquier otro caso el contenedor no expone la pasarela simulada y responde 404). Hace de "pagador" en la
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
    await ejecutarConContextoDb({ modo: 'sistema' }, () =>
      donaciones.conciliarDonacion({ idCargo: parsedInput.idCargo }, 'webhook'),
    )
    redirect(urlRetorno)
  })
