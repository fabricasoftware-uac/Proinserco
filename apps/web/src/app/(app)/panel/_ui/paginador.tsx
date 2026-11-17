import Link from 'next/link'
import type { ReactNode } from 'react'
import { AroProgreso } from '@/shared/ui/panel/aro'
import { formatearNumero } from '@/shared/ui/panel/formato'
import { Icono } from '@/shared/ui/panel/iconos'

type Props = {
  desde: number
  hasta: number
  total: number
  anterior: string | null
  siguiente: string | null
  /** Para el lector de pantalla: qué se pagina. */
  etiqueta: string
}

function Boton({ href, children, sentido }: { href: string | null; children: ReactNode; sentido: 'anterior' | 'siguiente' }) {
  const contenido = (
    <>
      {sentido === 'anterior' ? <Icono nombre="flecha-izq" tamano={16} /> : null}
      <span>{children}</span>
      {sentido === 'siguiente' ? <Icono nombre="flecha-der" tamano={16} /> : null}
    </>
  )
  if (!href)
    return (
      <span className="pn-boton pn-boton--chico" aria-disabled="true">
        {contenido}
      </span>
    )
  return (
    <Link className="pn-boton pn-boton--chico" href={href} scroll={false} rel={sentido === 'anterior' ? 'prev' : 'next'}>
      {contenido}
    </Link>
  )
}

/** Paginación por enlaces (funciona sin JavaScript). El aro muestra cuánto del total llevas recorrido. */
export function Paginador({ desde, hasta, total, anterior, siguiente, etiqueta }: Props) {
  return (
    <nav className="pn-paginador" aria-label={`Paginación de ${etiqueta}`}>
      <span className="pn-paginador-resumen" aria-live="polite">
        <AroProgreso fraccion={total ? hasta / total : 0} tamano={30} grosor={12} />
        <span>
          <b>
            {formatearNumero(desde)}–{formatearNumero(hasta)}
          </b>{' '}
          de {formatearNumero(total)}
        </span>
      </span>
      <div className="pn-paginador-botones">
        <Boton href={anterior} sentido="anterior">
          Anterior
        </Boton>
        <Boton href={siguiente} sentido="siguiente">
          Siguiente
        </Boton>
      </div>
    </nav>
  )
}
