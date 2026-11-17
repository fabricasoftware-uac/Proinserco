'use client'

import { abrirPreferenciasCookies } from '@/shared/ui/legal/consentimiento-cookies'

/** Reabre la configuración de cookies (dispara `cookies:abrir`). */
export function BotonCookies({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => abrirPreferenciasCookies()} className={className}>
      Preferencias de cookies
    </button>
  )
}
