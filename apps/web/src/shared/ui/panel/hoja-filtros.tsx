'use client'

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Icono } from './iconos'

type Props = {
  /** Filtros activos (para el contador del botón en móvil). */
  activos: number
  children: ReactNode
}

/**
 * En escritorio los filtros se ven en línea; en móvil viven en una hoja inferior
 * que se abre con un botón. Es el MISMO formulario: no se duplica nada.
 */
export function HojaFiltros({ activos, children }: Props) {
  const [abierta, setAbierta] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const hoja = useRef<HTMLDivElement>(null)
  const idHoja = useId()
  const idTitulo = useId()

  useEffect(() => {
    if (!abierta) return
    hoja.current?.querySelector<HTMLElement>('input:not([type=hidden]), button, select')?.focus()
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierta(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('keydown', teclas)
    return () => document.removeEventListener('keydown', teclas)
  }, [abierta])

  return (
    <div className="pn-hoja-envoltura" data-abierta={abierta ? '' : undefined}>
      <button
        ref={boton}
        type="button"
        className="pn-hoja-disparador"
        aria-expanded={abierta}
        aria-controls={idHoja}
        onClick={() => setAbierta(true)}
      >
        <Icono nombre="filtro" tamano={18} />
        <span>Buscar y filtrar</span>
        <span className="pn-hoja-cuenta" data-cero={activos === 0 ? '' : undefined}>
          {activos}
          <span className="pn-solo-lectores"> filtros activos</span>
        </span>
      </button>
      <div className="pn-hoja-velo" aria-hidden="true" onClick={() => setAbierta(false)} />
      <section className="pn-hoja" id={idHoja} ref={hoja} aria-labelledby={idTitulo}>
        <div className="pn-hoja-cab">
          <h2 id={idTitulo}>Buscar y filtrar</h2>
          <button
            type="button"
            className="pn-boton pn-boton--suave pn-boton--icono"
            aria-label="Cerrar filtros"
            onClick={() => {
              setAbierta(false)
              boton.current?.focus()
            }}
          >
            <Icono nombre="cerrar" />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
