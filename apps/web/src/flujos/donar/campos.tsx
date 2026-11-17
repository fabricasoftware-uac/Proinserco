import type { ReactNode } from 'react'

/** Clases compartidas por los controles del flujo (áreas táctiles ≥ 44 px). */
export const CLASE_CONTROL =
  'min-h-12 w-full rounded-control border-2 bg-superficie px-4 text-cuerpo text-texto placeholder:text-texto-suave/70'

export function claseBorde(hayError: boolean): string {
  return hayError ? 'border-peligro' : 'border-borde'
}

type CampoProps = {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string | undefined
  children: (aria: { 'aria-describedby': string | undefined; 'aria-invalid': boolean }) => ReactNode
}

/** Etiqueta visible + ayuda + error asociados al control con aria-describedby. */
export function Campo({ id, etiqueta, ayuda, error, children }: CampoProps) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const idError = error ? `${id}-error` : undefined
  const describedby = [idAyuda, idError].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-pequeno font-semibold">
        {etiqueta}
      </label>
      {children({ 'aria-describedby': describedby, 'aria-invalid': Boolean(error) })}
      {ayuda && (
        <p id={idAyuda} className="mt-1.5 text-micro text-texto-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="mt-1.5 text-pequeno font-semibold text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}

export function IconoCandado({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function IconoEscudo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function IconoTarjetaTachada({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M4 4l16 16" />
    </svg>
  )
}
