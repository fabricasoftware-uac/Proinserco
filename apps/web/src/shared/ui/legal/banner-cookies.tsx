'use client'

import Link from 'next/link'
import { type KeyboardEvent, type Ref, useCallback, useEffect, useId, useRef, useState } from 'react'
import { FlechaTrazo } from '@/shared/ui/sitio/flecha'
import {
  abrirPreferenciasCookies,
  EVENTO_ABRIR_COOKIES,
  guardarConsentimiento,
  leerConsentimiento,
  SIN_OPCIONALES,
  TODAS,
} from './consentimiento-cookies'

export { abrirPreferenciasCookies, leerConsentimiento }

const BOTON =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-pastilla border-2 border-acento px-5 text-pequeno font-semibold'

type Estado = 'oculto' | 'resumen' | 'configurar'

/**
 * Banner de cookies opt-in. Hoy el sitio solo usa cookies necesarias, pero el
 * mecanismo ya está listo: ninguna analítica o categoría opcional debe cargarse
 * sin pasar por `leerConsentimiento()` / evento `cookies:consentimiento`.
 * Marketing no se ofrece porque no aplica (se añadiría aquí si algún día aplica).
 * Mientras es visible publica su altura en `--banner-cookies-alto` (<html>).
 */
export function BannerCookies() {
  const [estado, setEstado] = useState<Estado>('oculto')
  const [prefs, setPrefs] = useState({ preferencias: false, analitica: false })
  const raiz = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const primerSwitch = useRef<HTMLInputElement>(null)
  const yaDecidido = useRef(false)
  const idTitulo = useId()

  // Lectura en cliente: sin parpadeo en SSR (no se renderiza nada hasta saber).
  useEffect(() => {
    const actual = leerConsentimiento()
    yaDecidido.current = actual !== null
    if (actual) setPrefs({ preferencias: actual.categorias.preferencias, analitica: actual.categorias.analitica })
    else setEstado('resumen')

    const reabrir = () => {
      const c = leerConsentimiento()
      yaDecidido.current = c !== null
      setPrefs({ preferencias: c?.categorias.preferencias ?? false, analitica: c?.categorias.analitica ?? false })
      setEstado('configurar')
    }
    window.addEventListener(EVENTO_ABRIR_COOKIES, reabrir)
    return () => window.removeEventListener(EVENTO_ABRIR_COOKIES, reabrir)
  }, [])

  // Altura publicada para que la barra fija de donar no quede tapada.
  useEffect(() => {
    const html = document.documentElement
    const nodo = raiz.current
    if (estado === 'oculto' || !nodo) {
      html.style.setProperty('--banner-cookies-alto', '0px')
      return
    }
    const medir = () => html.style.setProperty('--banner-cookies-alto', `${Math.ceil(nodo.getBoundingClientRect().height)}px`)
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(nodo)
    return () => {
      obs.disconnect()
      html.style.setProperty('--banner-cookies-alto', '0px')
    }
  }, [estado])

  // Foco: solo al reabrir/expandir; nunca se roba al cargar la página.
  useEffect(() => {
    if (estado === 'configurar') primerSwitch.current?.focus()
  }, [estado])

  const decidir = useCallback((c: { preferencias: boolean; analitica: boolean }) => {
    guardarConsentimiento(c)
    yaDecidido.current = true
    setEstado('oculto')
  }, [])

  const alTeclear = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    // Escape nunca acepta nada: solo cierra la configuración / el banner reabierto.
    if (yaDecidido.current) setEstado('oculto')
    else if (estado === 'configurar') {
      setEstado('resumen')
      titulo.current?.focus()
    }
  }

  if (estado === 'oculto') return null

  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="false"
      aria-labelledby={idTitulo}
      data-seccion-tema="bosque"
      onKeyDown={alTeclear}
      className="banner-cookies fixed inset-x-2 bottom-2 z-[60] rounded-[1.25rem] border-2 border-[var(--pintura-lima)] bg-superficie px-3.5 pt-2.5 pb-3 text-texto shadow-[0_-8px_30px_rgb(0_0_0/0.25)] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:p-5"
    >
      <div className="max-h-[75dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h2
            id={idTitulo}
            ref={titulo}
            tabIndex={-1}
            className="flex items-center gap-2 font-display text-[1.15rem] leading-none font-extrabold uppercase [font-stretch:78%]"
          >
            <FlechaTrazo grosor={12} className="size-5 text-[var(--pintura-lima)]" />
            Tu privacidad
          </h2>
          {estado === 'resumen' ? (
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-pastilla px-2 text-pequeno font-semibold underline underline-offset-2"
              onClick={() => setEstado('configurar')}
            >
              Configurar
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-micro text-texto-suave sm:text-pequeno">
          Hoy este sitio solo usa cookies necesarias: recordar esta decisión, la seguridad del formulario y el acceso del equipo.
          No usamos analítica ni publicidad; si algún día las añadimos, te preguntaremos antes.{' '}
          <Link href="/legal/cookies" className="underline underline-offset-2">
            Política de cookies
          </Link>
        </p>

        {estado === 'configurar' && (
          <fieldset className="mt-3 space-y-1">
            <legend className="sr-only">Categorías de cookies</legend>
            <Categoria titulo="Necesarias" descripcion="Siempre activas: el sitio no funciona sin ellas." marcada desactivada />
            <Categoria
              ref={primerSwitch}
              titulo="Preferencias"
              descripcion="Recordarían ajustes como el tema. Hoy no usamos ninguna."
              marcada={prefs.preferencias}
              alCambiar={(v) => setPrefs((p) => ({ ...p, preferencias: v }))}
            />
            <Categoria
              titulo="Analítica"
              descripcion="Nos dirían cómo se usa el sitio. Hoy no usamos ninguna."
              marcada={prefs.analitica}
              alCambiar={(v) => setPrefs((p) => ({ ...p, analitica: v }))}
            />
          </fieldset>
        )}

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" className={`${BOTON} bg-acento text-sobre-acento`} onClick={() => decidir(SIN_OPCIONALES)}>
            Rechazar
          </button>
          <button type="button" className={`${BOTON} bg-acento text-sobre-acento`} onClick={() => decidir(TODAS)}>
            Aceptar todas
          </button>
          {estado === 'configurar' ? (
            <button type="button" className={`${BOTON} basis-full text-texto`} onClick={() => decidir(prefs)}>
              Guardar mi selección
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Categoria({
  titulo,
  descripcion,
  marcada,
  desactivada,
  alCambiar,
  ref,
}: {
  titulo: string
  descripcion: string
  marcada: boolean
  desactivada?: boolean
  alCambiar?: (v: boolean) => void
  ref?: Ref<HTMLInputElement>
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-control py-2">
      <input
        ref={ref}
        type="checkbox"
        className="mt-0.5 size-6 shrink-0 accent-[var(--acento)]"
        checked={marcada}
        disabled={desactivada}
        onChange={(e) => alCambiar?.(e.target.checked)}
      />
      <span>
        <span className="block text-pequeno font-semibold">{titulo}</span>
        <span className="block text-micro text-texto-suave">{descripcion}</span>
      </span>
    </label>
  )
}
