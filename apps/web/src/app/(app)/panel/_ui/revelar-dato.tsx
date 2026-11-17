'use client'

import { useAction } from 'next-safe-action/hooks'
import { type CSSProperties, useEffect, useState } from 'react'
import { revelarDatoDonanteAccion } from '@/modules/donantes/ui/acciones-panel'
import { DatoEnmascarado } from '@/shared/ui/panel/datos'
import { DialogoConfirmacion } from '@/shared/ui/panel/dialogo'
import { Icono } from '@/shared/ui/panel/iconos'

type Props = {
  donanteId: string
  campo: 'correo' | 'celular' | 'numeroDocumento'
  etiqueta: string
  /** Lo que se ve por defecto (ya enmascarado en el servidor). */
  enmascarado: string
  /** Solo interfaz: el servidor exige `donantes:revelar` y deja auditoría. */
  puedeRevelar: boolean
}

const SEGUNDOS_VISIBLE = 30

/**
 * Dato personal enmascarado + "Revelar". El valor completo NO viaja al navegador hasta que
 * se confirma; la petición exige permiso y queda auditada. Aparece aclarándose desde un
 * desenfoque y un aro de cuenta atrás muestra cuánto falta para que se vuelva a ocultar (30 s).
 */
export function RevelarDato({ donanteId, campo, etiqueta, enmascarado, puedeRevelar }: Props) {
  const [valor, setValor] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { execute, isPending } = useAction(revelarDatoDonanteAccion, {
    onSuccess: ({ data }) => {
      if (!data) return
      setValor(data.valor)
      setAbierto(false)
    },
    onError: ({ error: e }) => setError(e.serverError?.mensaje ?? 'No pudimos revelar el dato.'),
  })

  useEffect(() => {
    if (valor === null) return
    const temporizador = setTimeout(() => setValor(null), SEGUNDOS_VISIBLE * 1000)
    return () => clearTimeout(temporizador)
  }, [valor])

  return (
    <span className="pn-revelar">
      {valor !== null ? <DatoEnmascarado key="v" valor={valor} revelado /> : <DatoEnmascarado key="m" valor={enmascarado} />}
      {valor !== null ? (
        <>
          <span
            className="pn-revelar-reloj"
            title={`Se oculta en ${SEGUNDOS_VISIBLE} segundos`}
            style={{ '--pn-segundos': `${SEGUNDOS_VISIBLE}s` } as CSSProperties}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <circle className="pn-reloj-pista" cx="9" cy="9" r="7" />
              <circle className="pn-reloj-arco" cx="9" cy="9" r="7" transform="rotate(-90 9 9)" />
            </svg>
          </span>
          <button type="button" className="pn-boton pn-boton--suave pn-boton--chico" onClick={() => setValor(null)}>
            <Icono nombre="ojo-cerrado" tamano={15} />
            Ocultar<span className="pn-solo-lectores"> {etiqueta}</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          className="pn-boton pn-boton--chico"
          disabled={!puedeRevelar}
          title={puedeRevelar ? undefined : 'Tu rol no tiene el permiso para revelar datos personales'}
          onClick={() => {
            setError(null)
            setAbierto(true)
          }}
        >
          <Icono nombre="ojo" tamano={15} />
          Revelar<span className="pn-solo-lectores"> {etiqueta}</span>
        </button>
      )}
      <DialogoConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        onConfirmar={() => execute({ donanteId, campo })}
        titulo={`¿Revelar ${etiqueta.toLowerCase()}?`}
        etiquetaConfirmar="Revelar por 30 s"
        pendiente={isPending}
        error={error}
      >
        <p>
          Verás el dato completo durante {SEGUNDOS_VISIBLE} segundos. La consulta queda en la auditoría con tu usuario y la hora;
          el valor no se guarda en ningún lado.
        </p>
      </DialogoConfirmacion>
    </span>
  )
}
