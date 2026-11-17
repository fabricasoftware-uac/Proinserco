import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolverPasarelaSimuladaAccion } from '@/modules/donaciones/ui/acciones-pasarela-simulada'
import { obtenerContenedor } from '@/server/container'
import { formatearPesos } from '@/shared/lib/formato-moneda'

export const metadata: Metadata = { title: 'Pasarela de pruebas', robots: { index: false, follow: false } }

/**
 * PASARELA SIMULADA — entorno de pruebas (solo ADAPTADORES=memoria).
 * Sustituye a la página de pago hospedada de Openpay. No pide ni acepta
 * datos de tarjeta: solo permite elegir el resultado del pago. A propósito
 * NO se parece a Openpay ni usa su marca.
 */
export default async function PaginaPasarelaSimulada({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { cargo } = await searchParams
  const { pasarelaSimulada } = await obtenerContenedor()
  if (!pasarelaSimulada || typeof cargo !== 'string') notFound()
  const vista = pasarelaSimulada.verCargo(cargo)
  if (!vista) notFound()

  const idCargo = vista.idCargo
  // Next cifra el valor capturado (idCargo) en la referencia de la acción.
  async function aprobar() {
    'use server'
    await resolverPasarelaSimuladaAccion({ idCargo, resultado: 'aprobado' })
  }
  async function rechazar() {
    'use server'
    await resolverPasarelaSimuladaAccion({ idCargo, resultado: 'rechazado' })
  }

  return (
    <main
      data-pasarela-simulada=""
      data-seccion-tema="crema"
      className="min-h-dvh bg-superficie px-gutter pb-16 pt-28 text-texto"
    >
      <div className="mx-auto max-w-lg">
        <p role="alert" className="pasarela-cinta">
          ENTORNO DE PRUEBAS — pasarela simulada
        </p>
        <p className="mt-2 text-center text-micro text-texto-suave">
          Aquí no se cobra dinero real ni se pide ningún dato de tarjeta.
        </p>

        <section aria-labelledby="titulo-simulada" className="pasarela-tarjeta">
          <h1 id="titulo-simulada" className="pasarela-titulo">
            Pago de prueba
          </h1>
          <dl className="pasarela-datos">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-texto-suave">Concepto</dt>
              <dd className="text-right">{vista.descripcion}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-texto-suave">Cargo a simular</dt>
              <dd className="pasarela-monto">{formatearPesos(vista.montoPesos)}</dd>
            </div>
          </dl>

          {vista.estado === 'pendiente' ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <form action={rechazar}>
                <button type="submit" className="min-h-12 w-full rounded-control border border-borde px-5 font-semibold">
                  Rechazar pago
                </button>
              </form>
              <form action={aprobar}>
                <button type="submit" className="min-h-12 w-full rounded-control bg-acento px-5 font-semibold text-sobre-acento">
                  Aprobar pago
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-6 font-semibold">Este cargo ya está {vista.estado}.</p>
          )}
        </section>
      </div>
    </main>
  )
}
