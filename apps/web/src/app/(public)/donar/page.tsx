import type { Metadata } from 'next'
import { FormularioDonar } from '@/flujos/donar/formulario-donar'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { LineaApoyo } from '@/modules/donaciones'
import { obtenerEnv } from '@/server/env'
import { envPublico } from '@/shared/env-publico'

export const metadata: Metadata = {
  title: 'Donar',
  description: 'Dona a la Fundación Proinserco de forma segura. El pago se hace en la página protegida de Openpay.',
}

type Busqueda = Promise<Record<string, string | string[] | undefined>>

/** Formulario de donación en pasos. Esquema: flujos/donar/esquema.ts · Acción: flujos/donar/acciones.ts */
export default async function PaginaDonar({ searchParams }: { searchParams: Busqueda }) {
  const { monto, linea } = await searchParams
  const env = obtenerEnv()
  const minimoPesos = env.DONACION_MONTO_MINIMO_COP
  const maximoPesos = env.DONACION_MONTO_MAXIMO_COP

  // `?monto=` de la URL solo precarga: el servidor vuelve a validar todo.
  const montoUrl = typeof monto === 'string' && /^\d{1,10}$/.test(monto) ? Number(monto) : null
  const montoInicial = montoUrl !== null && montoUrl >= minimoPesos && montoUrl <= maximoPesos ? montoUrl : null
  const lineaInicial = LineaApoyo.safeParse(typeof linea === 'string' ? linea : undefined).data ?? 'donde-mas-se-necesite'

  return (
    <main
      data-seccion-tema="crema"
      data-nav="crema"
      data-nav-titulo="Donar"
      className="flujo-donar min-h-dvh bg-superficie px-gutter pb-16 pt-28 text-texto"
    >
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-end md:gap-10">
          <h1 data-lineas="" className="flujo-donar-titulo mega" aria-label={CONTENIDO_SITIO.donar.titulo}>
            <span aria-hidden="true" className="l">
              <span className="l-in">{CONTENIDO_SITIO.donar.titulo.split(' ')[0]}</span>
            </span>
            <span aria-hidden="true" className="l flujo-donar-titulo-2">
              <span className="l-in enfasis">{CONTENIDO_SITIO.donar.titulo.split(' ').slice(1).join(' ')}</span>
            </span>
          </h1>
          <p data-rev="subir" className="max-w-md text-realce text-texto-suave md:pb-3">
            {CONTENIDO_SITIO.donar.llamado}
          </p>
        </header>
        <FormularioDonar
          minimoPesos={minimoPesos}
          maximoPesos={maximoPesos}
          montosSugeridos={CONTENIDO_SITIO.donar.montosSugeridosPesos}
          montoInicial={montoInicial}
          lineaInicial={lineaInicial}
          antibots={env.antibots}
          siteKey={envPublico.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        />
      </div>
    </main>
  )
}
