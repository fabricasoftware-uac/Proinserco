'use client'

import { useRouter } from 'next/navigation'
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Icono, type NombreIcono } from './iconos'

type Destino = Readonly<{ href: string; etiqueta: string; icono: NombreIcono }>

export type PaletaControl = { abrir: () => void }

type Props = {
  destinos: readonly Destino[]
  /** Solo interfaz: la búsqueda de donaciones exige `donaciones:leer` en el servidor. */
  puedeBuscar: boolean
}

type Opcion = Readonly<{ id: string; etiqueta: string; detalle: string; icono: NombreIcono; href: string }>

const quitarTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Paleta de búsqueda (Ctrl/Cmd + K): busca donaciones por referencia o correo y
 * salta a cualquier sección. <dialog> nativo: foco atrapado, Escape y retorno del foco.
 */
export const Paleta = forwardRef<PaletaControl, Props>(function Paleta({ destinos, puedeBuscar }, ref) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [activa, setActiva] = useState(0)
  const idLista = useId()
  const idEtiqueta = useId()

  useImperativeHandle(ref, () => ({
    abrir: () => {
      const d = dialogo.current
      if (!d || d.open) return
      setTexto('')
      setActiva(0)
      d.showModal()
      requestAnimationFrame(() => entrada.current?.focus())
    },
  }))

  const opciones = useMemo<Opcion[]>(() => {
    const q = texto.trim()
    const lista: Opcion[] = []
    if (puedeBuscar && q.length >= 2) {
      lista.push({
        id: 'buscar',
        etiqueta: `Buscar «${q.slice(0, 100)}»`,
        detalle: 'en donaciones, por referencia o correo',
        icono: 'buscar',
        href: `/panel/donaciones?q=${encodeURIComponent(q.slice(0, 100))}`,
      })
    }
    const n = quitarTildes(q)
    for (const d of destinos) {
      if (!n || quitarTildes(d.etiqueta).includes(n)) {
        lista.push({ id: d.href, etiqueta: d.etiqueta, detalle: 'Ir a la sección', icono: d.icono, href: d.href })
      }
    }
    return lista
  }, [texto, destinos, puedeBuscar])

  useEffect(() => {
    setActiva((a) => Math.min(a, Math.max(0, opciones.length - 1)))
  }, [opciones.length])

  function ir(o: Opcion | undefined) {
    if (!o) return
    dialogo.current?.close()
    router.push(o.href)
  }

  const idOpcion = (i: number) => `${idLista}-${i}`

  return (
    <dialog
      ref={dialogo}
      className="pn-paleta"
      aria-labelledby={idEtiqueta}
      onClick={(e) => {
        if (e.target === dialogo.current) dialogo.current?.close()
      }}
      onKeyDown={() => undefined}
    >
      <div className="pn-paleta-cuerpo">
        <label className="pn-paleta-campo">
          <span id={idEtiqueta} className="pn-solo-lectores">
            {puedeBuscar ? 'Buscar donaciones o ir a una sección' : 'Ir a una sección'}
          </span>
          <Icono nombre="buscar" tamano={20} />
          <input
            ref={entrada}
            role="combobox"
            aria-expanded="true"
            aria-controls={idLista}
            aria-activedescendant={opciones.length ? idOpcion(activa) : undefined}
            aria-autocomplete="list"
            value={texto}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            placeholder={puedeBuscar ? 'Referencia, correo o sección…' : 'Sección…'}
            onChange={(e) => {
              setTexto(e.target.value)
              setActiva(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiva((a) => (opciones.length ? (a + 1) % opciones.length : 0))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiva((a) => (opciones.length ? (a - 1 + opciones.length) % opciones.length : 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                ir(opciones[activa])
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <div role="listbox" id={idLista} className="pn-paleta-lista" aria-label="Resultados">
          {opciones.length === 0 ? (
            <p className="pn-paleta-vacia">
              {puedeBuscar && texto.trim().length < 2
                ? 'Escribe al menos dos letras para buscar.'
                : 'Nada por aquí con ese nombre.'}
            </p>
          ) : (
            opciones.map((o, i) => (
              <div
                key={o.id}
                id={idOpcion(i)}
                role="option"
                tabIndex={-1}
                aria-selected={i === activa}
                className="pn-paleta-opcion"
                onPointerMove={() => setActiva(i)}
                onClick={() => ir(o)}
                onKeyDown={() => undefined}
              >
                <span className="pn-paleta-icono">
                  <Icono nombre={o.icono} tamano={18} />
                </span>
                <span className="pn-paleta-texto">
                  <strong>{o.etiqueta}</strong>
                  <small>{o.detalle}</small>
                </span>
                <Icono nombre="enter" tamano={16} className="pn-paleta-enter" />
              </div>
            ))
          )}
        </div>
      </div>
    </dialog>
  )
})
