'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Icono } from './iconos'

type Props = {
  valor: string
  /** Si se da, el identificador es además un enlace. */
  href?: string | undefined
  /** Qué es, para el botón de copiar ("referencia", "id de cargo"). */
  que: string
  /** Mostrar el botón solo al pasar por encima (en filas de tabla). */
  discreto?: boolean
  /** Recortar con puntos suspensivos (el valor completo queda en el título y al copiar). */
  corto?: boolean
}

/** Identificador en monoespaciada con botón de copiar y confirmación accesible. */
export function Identificador({ valor, href, que, discreto = false, corto = false }: Props) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 1600)
    return () => clearTimeout(t)
  }, [copiado])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
    } catch {
      // Sin permiso de portapapeles: no hay nada que hacer, el texto sigue seleccionable.
    }
  }

  return (
    <span
      className={`pn-id${discreto ? ' pn-id--discreto' : ''}${corto ? ' pn-id--corto' : ''}`}
      title={corto ? valor : undefined}
      data-copiado={copiado ? '' : undefined}
    >
      {href ? (
        <Link className="pn-id-valor pn-id-enlace" href={href}>
          {valor}
        </Link>
      ) : (
        <span className="pn-id-valor">{valor}</span>
      )}
      <button type="button" className="pn-id-copiar" onClick={copiar} aria-label={`Copiar ${que}`}>
        <Icono nombre={copiado ? 'check' : 'copiar'} tamano={14} />
      </button>
      <span className="pn-solo-lectores" aria-live="polite">
        {copiado ? `Copiado al portapapeles: ${que}` : ''}
      </span>
    </span>
  )
}
