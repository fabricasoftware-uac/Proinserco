'use client'

import { abrirPreferenciasCookies } from './consentimiento-cookies'

/** Botón de la página de cookies: reabre el banner en modo configuración. */
export function CookiesPreferencias() {
  return (
    <button
      type="button"
      onClick={abrirPreferenciasCookies}
      className="mt-4 inline-flex min-h-12 items-center rounded-pastilla border-2 border-acento bg-acento px-6 font-semibold text-sobre-acento"
    >
      Preferencias de cookies
    </button>
  )
}
