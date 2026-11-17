'use client'

import { useAction } from 'next-safe-action/hooks'
import { useState } from 'react'
import { exportarDonacionesAccion } from '@/modules/donaciones/ui/acciones-panel'
import { Aro } from '@/shared/ui/panel/aro'
import { DialogoConfirmacion } from '@/shared/ui/panel/dialogo'
import { Icono } from '@/shared/ui/panel/iconos'

type Filtros = Readonly<{
  estado?: string
  linea?: string
  q?: string
  desde?: string
  hasta?: string
  minPesos?: number
  maxPesos?: number
  orden: 'fecha' | 'monto' | 'estado'
  dir: 'asc' | 'desc'
}>

type Props = {
  filtros: Filtros
  /** Filas que cumplen los filtros (solo para informar antes de exportar). */
  total: number
  /** Solo interfaz: el servidor exige `donaciones:exportar` en la acción. */
  puedeExportar: boolean
}

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Exportación CSV con confirmación reforzada (hay que escribir EXPORTAR). Queda auditada en el servidor. */
export function ExportarCsv({ filtros, total, puedeExportar }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { execute, isPending } = useAction(exportarDonacionesAccion, {
    onSuccess: ({ data }) => {
      if (!data) return
      descargar(data.nombreArchivo, data.csv)
      setAbierto(false)
      setMensaje(
        `Exportación lista: ${data.filas} ${data.filas === 1 ? 'fila' : 'filas'}${data.truncado ? ' (se alcanzó el tope de filas)' : ''}. Quedó registrada en la auditoría.`,
      )
    },
    onError: ({ error: e }) => setError(e.serverError?.mensaje ?? 'No pudimos exportar. Inténtalo de nuevo.'),
  })

  if (!puedeExportar) {
    return (
      <button type="button" className="pn-boton" disabled title="Tu rol no tiene el permiso para exportar">
        <Icono nombre="descargar" tamano={18} />
        Exportar CSV
        <span className="pn-solo-lectores">: tu rol no tiene permiso para exportar</span>
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="pn-boton"
        onClick={() => {
          setError(null)
          setMensaje(null)
          setAbierto(true)
        }}
        disabled={total === 0}
      >
        <Icono nombre="descargar" tamano={18} />
        Exportar CSV
      </button>
      <output className="pn-solo-lectores" aria-live="polite">
        {mensaje}
      </output>
      {mensaje ? (
        <span className="pn-export-ok" aria-hidden="true">
          <Aro forma="cerrado" tono="ok" tamano={16} />
          Exportación lista y auditada
        </span>
      ) : null}
      <DialogoConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        onConfirmar={() => execute(filtros)}
        titulo="Exportar donaciones"
        etiquetaConfirmar="Exportar"
        palabraClave="EXPORTAR"
        pendiente={isPending}
        error={error}
      >
        <p>
          Se exportarán <strong>{total}</strong> {total === 1 ? 'donación' : 'donaciones'} con los filtros actuales a un archivo
          CSV.
        </p>
        <p>
          Los datos personales salen enmascarados. La exportación queda registrada en la auditoría con tu usuario, la hora y los
          filtros usados.
        </p>
      </DialogoConfirmacion>
    </>
  )
}
