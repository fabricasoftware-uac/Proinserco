'use client'

import { useEffect, useRef, useState } from 'react'

/** Token que acepta el verificador en memoria (cualquier cadena no vacía salvo `rechazar-antibots`). */
export const TOKEN_ANTIBOTS_DEMO = 'demo-antibots-token'

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type OpcionesWidget = {
  sitekey: string
  language: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}
type ApiTurnstile = { render: (el: HTMLElement, o: OpcionesWidget) => string; remove: (id: string) => void }
declare global {
  interface Window {
    turnstile?: ApiTurnstile
  }
}

let promesaScript: Promise<void> | null = null
function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  promesaScript ??= new Promise<void>((resolver, rechazar) => {
    const s = document.createElement('script')
    s.src = URL_SCRIPT
    s.async = true
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
  token: string
  alCambiar: (token: string) => void
  error?: string | undefined
  /** Cambiar este número reinicia la verificación (los tokens son de un solo uso). */
  reinicio: number
}

export function VerificacionAntiBots({ modo, siteKey, token, alCambiar, error, reinicio }: Props) {
  return (
    <div className="rounded-control border-2 border-borde-sutil bg-superficie p-4">
      <p className="text-pequeno font-semibold">Verificación de seguridad</p>
      <p className="mb-3 text-micro text-texto-suave">Así evitamos que programas automáticos usen este formulario.</p>
      {modo === 'turnstile' ? (
        <Turnstile siteKey={siteKey} alCambiar={alCambiar} reinicio={reinicio} />
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

function Turnstile({ siteKey, alCambiar, reinicio }: Pick<Props, 'siteKey' | 'alCambiar' | 'reinicio'>) {
  const contenedor = useRef<HTMLDivElement>(null)
  const alCambiarRef = useRef(alCambiar)
  alCambiarRef.current = alCambiar
  const [fallo, setFallo] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reinicio` fuerza un widget nuevo a propósito
  useEffect(() => {
    let id: string | null = null
    let activo = true
    setFallo(false)
    cargarScript()
      .then(() => {
        if (!activo || !contenedor.current || !window.turnstile) return
        id = window.turnstile.render(contenedor.current, {
          sitekey: siteKey,
          language: 'es',
          callback: (t) => alCambiarRef.current(t),
          'expired-callback': () => alCambiarRef.current(''),
          'error-callback': () => {
            alCambiarRef.current('')
            setFallo(true)
          },
        })
      })
      .catch(() => setFallo(true))
    return () => {
      activo = false
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [siteKey, reinicio])
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
