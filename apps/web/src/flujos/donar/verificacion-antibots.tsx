'use client'

import { useEffect, useRef, useState } from 'react'
import { ACCION_TURNSTILE_DONAR } from '@/shared/domain/antibots'
import { type TemaTurnstile, temaTurnstile } from './tema-turnstile'

/** Token que acepta el verificador en memoria (cualquier cadena no vacía salvo `rechazar-antibots`). */
export const TOKEN_ANTIBOTS_DEMO = 'demo-antibots-token'

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type OpcionesWidget = {
  sitekey: string
  action: string
  theme: TemaTurnstile
  language: string
  'refresh-expired': 'auto' | 'manual' | 'never'
  callback: (token: string) => void
  'expired-callback': () => void
  'timeout-callback': () => void
  'error-callback': () => boolean | undefined
}
type ApiTurnstile = {
  render: (el: HTMLElement, o: OpcionesWidget) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

/** Espera antes de reintentar tras un error del widget (red, bloqueo temporal). */
const ESPERA_REINTENTO_MS = 4_000

declare global {
  interface Window {
    turnstile?: ApiTurnstile
  }
}

let promesaScript: Promise<void> | null = null
/** Script oficial en modo explícito, con el nonce de la CSP de esta petición. */
function cargarScript(nonce: string | undefined): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  promesaScript ??= new Promise<void>((resolver, rechazar) => {
    const s = document.createElement('script')
    s.src = URL_SCRIPT
    s.async = true
    if (nonce) s.nonce = nonce
    s.onload = () => resolver()
    s.onerror = () => {
      promesaScript = null
      rechazar(new Error('turnstile'))
    }
    document.head.appendChild(s)
  })
  return promesaScript
}

type Props = {
  modo: 'memoria' | 'turnstile'
  siteKey: string
  /** Nonce de la CSP (lo pone el proxy; la página lo lee con nonceCsp()). */
  nonce?: string | undefined
  token: string
  alCambiar: (token: string) => void
  error?: string | undefined
  /** Cambiar este número reinicia la verificación (los tokens son de un solo uso). */
  reinicio: number
}

export function VerificacionAntiBots({ modo, siteKey, nonce, token, alCambiar, error, reinicio }: Props) {
  return (
    <div className="rounded-control border-2 border-borde-sutil bg-superficie p-4">
      <p className="text-pequeno font-semibold">Verificación de seguridad</p>
      <p className="mb-3 text-micro text-texto-suave">Así evitamos que programas automáticos usen este formulario.</p>
      {modo === 'turnstile' ? (
        <Turnstile siteKey={siteKey} nonce={nonce} alCambiar={alCambiar} reinicio={reinicio} />
      ) : (
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-6 accent-[var(--acento)]"
            checked={token !== ''}
            onChange={(e) => alCambiar(e.target.checked ? TOKEN_ANTIBOTS_DEMO : '')}
          />
          <span className="text-cuerpo">Soy una persona</span>
        </label>
      )}
      {modo === 'memoria' && (
        <p className="mt-2 text-micro text-texto-suave">
          Modo de demostración: en el sitio real aquí aparece la verificación de Cloudflare Turnstile.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-pequeno font-semibold text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}

function Turnstile({ siteKey, nonce, alCambiar, reinicio }: Pick<Props, 'siteKey' | 'nonce' | 'alCambiar' | 'reinicio'>) {
  const contenedor = useRef<HTMLDivElement>(null)
  const alCambiarRef = useRef(alCambiar)
  alCambiarRef.current = alCambiar
  const [fallo, setFallo] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reinicio` fuerza un widget nuevo a propósito
  useEffect(() => {
    let id: string | null = null
    let activo = true
    let temporizador: ReturnType<typeof setTimeout> | undefined
    setFallo(false)
    const reiniciar = () => {
      alCambiarRef.current('')
      if (id && window.turnstile) window.turnstile.reset(id)
    }
    cargarScript(nonce)
      .then(() => {
        if (!activo || !contenedor.current || !window.turnstile) return
        id = window.turnstile.render(contenedor.current, {
          sitekey: siteKey,
          action: ACCION_TURNSTILE_DONAR,
          theme: temaTurnstile(document.documentElement.dataset.tema),
          language: 'es',
          'refresh-expired': 'manual',
          callback: (t) => {
            setFallo(false)
            alCambiarRef.current(t)
          },
          // Token caducado (300 s) o reto sin resolver a tiempo: widget nuevo.
          'expired-callback': reiniciar,
          'timeout-callback': reiniciar,
          'error-callback': () => {
            alCambiarRef.current('')
            setFallo(true)
            clearTimeout(temporizador)
            temporizador = setTimeout(() => activo && reiniciar(), ESPERA_REINTENTO_MS)
            return true // gestionado aquí: Turnstile no lanza en consola
          },
        })
      })
      .catch(() => setFallo(true))
    return () => {
      activo = false
      clearTimeout(temporizador)
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [siteKey, nonce, reinicio])
  return (
    <>
      <div ref={contenedor} className="min-h-[65px]" />
      {fallo && (
        <p role="alert" className="text-pequeno font-semibold text-peligro">
          No pudimos cargar la verificación. Revisa tu conexión o desactiva bloqueadores y recarga la página.
        </p>
      )}
    </>
  )
}
