'use client'

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

type Props = {
  abierto: boolean
  onCerrar: () => void
  onConfirmar: () => void
  titulo: string
  children: ReactNode
  etiquetaConfirmar: string
  tono?: 'primario' | 'peligro'
  /** Confirmacion reforzada: hay que escribir esta palabra para habilitar el boton. */
  palabraClave?: string
  pendiente?: boolean
  error?: string | null
}

/**
 * Dialogo de confirmacion sobre <dialog> nativo: showModal() atrapa el foco,
 * Escape cierra y el foco vuelve al elemento que lo abrio.
 */
export function DialogoConfirmacion({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  children,
  etiquetaConfirmar,
  tono = 'primario',
  palabraClave,
  pendiente = false,
  error,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idCampo = useId()
  const [escrito, setEscrito] = useState('')

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) {
      setEscrito('')
      dialogo.showModal()
    }
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  const habilitado = !pendiente && (!palabraClave || escrito.trim().toUpperCase() === palabraClave.toUpperCase())

  return (
    <dialog
      ref={ref}
      className="pn-dialogo"
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onCancel={(e) => {
        if (pendiente) e.preventDefault()
      }}
    >
      <form
        method="dialog"
        className="pn-dialogo-cuerpo"
        onSubmit={(e) => {
          e.preventDefault()
          if (habilitado) onConfirmar()
        }}
      >
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
        {palabraClave ? (
          <div>
            <label className="pn-etiqueta" htmlFor={idCampo}>
              Escribe {palabraClave} para confirmar
            </label>
            <input
              id={idCampo}
              className="pn-campo"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={escrito}
              onChange={(e) => setEscrito(e.target.value)}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="pn-error-campo">
            {error}
          </p>
        ) : null}
        <div className="pn-dialogo-acciones">
          <button type="button" className="pn-boton" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </button>
          <button
            type="submit"
            className={tono === 'peligro' ? 'pn-boton pn-boton--peligro' : 'pn-boton pn-boton--primario'}
            disabled={!habilitado}
          >
            {pendiente ? 'Procesando...' : etiquetaConfirmar}
          </button>
        </div>
      </form>
    </dialog>
  )
}
