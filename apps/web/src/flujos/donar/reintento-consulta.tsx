'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

const MAX_INTENTOS = 6
const ESPERA_MS = 5000

/**
 * Pago pendiente: vuelve a pedir la página al servidor (router.refresh, NO una
 * Server Action) cada 5 s, máximo 6 veces. Luego deja un botón manual.
 */
export function ReintentoConsulta() {
  const router = useRouter()
  const [intentos, setIntentos] = useState(0)
  const [actualizando, iniciar] = useTransition()

  useEffect(() => {
    if (intentos >= MAX_INTENTOS) return
    const t = setTimeout(() => {
      setIntentos((n) => n + 1)
      iniciar(() => router.refresh())
    }, ESPERA_MS)
    return () => clearTimeout(t)
  }, [intentos, router])

  return (
    <div className="mt-6" aria-live="polite">
      {intentos < MAX_INTENTOS ? (
        <p className="text-pequeno text-texto-suave">
          Estamos confirmando tu pago con el banco… {actualizando ? 'consultando' : 'volveremos a mirar en unos segundos'}.
        </p>
      ) : (
        <p className="text-pequeno text-texto-suave">
          Sigue pendiente. Puede tardar unos minutos más; también te avisaremos por correo cuando se confirme.
        </p>
      )}
      <button
        type="button"
        onClick={() => iniciar(() => router.refresh())}
        disabled={actualizando}
        className="mt-3 inline-flex min-h-12 items-center rounded-pastilla border-2 border-borde px-6 font-semibold disabled:opacity-60"
      >
        Consultar de nuevo
      </button>
    </div>
  )
}
