'use client'

import Link from 'next/link'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { formatoPesos } from './enlaces'
import { ARO_D, PUNTA_D } from './flecha'
import { lanzarSemillas, prefiereMenosMovimiento, registrarGsap } from './movimiento'

/** Montos como objetos con tamaño propio: no son cuatro píldoras iguales. */
const OBJETOS = [
  { nombre: 'Semilla', nivel: 0.3 },
  { nombre: 'Mata', nivel: 0.5 },
  { nombre: 'Árbol', nivel: 0.72 },
  { nombre: 'Bosque', nivel: 0.92 },
] as const

function GlifoMonto({ i }: { i: number }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="donar-glifo">
      {i === 0 ? <ellipse cx="24" cy="30" rx="8" ry="11" fill="currentColor" transform="rotate(-20 24 30)" /> : null}
      {i === 1 ? (
        <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          <path d="M24 44V22" />
          <path d="M24 28c-8 0-13-5-13-12 8 0 13 5 13 12ZM24 24c7-1 12-6 12-13-8 1-12 6-12 13Z" fill="currentColor" />
        </g>
      ) : null}
      {i === 2 ? (
        <g fill="currentColor">
          <rect x="21.5" y="28" width="5" height="16" rx="2" />
          <circle cx="24" cy="20" r="14" />
        </g>
      ) : null}
      {i === 3 ? (
        <g fill="currentColor">
          <circle cx="13" cy="24" r="9" />
          <circle cx="35" cy="22" r="10" />
          <circle cx="24" cy="16" r="12" />
          <rect x="22" y="26" width="4" height="18" rx="2" />
          <rect x="11" y="30" width="4" height="14" rx="2" />
          <rect x="33" y="30" width="4" height="14" rx="2" />
        </g>
      ) : null}
    </svg>
  )
}

/**
 * E7 — "El aro que se llena". Elegir un monto llena el aro de la flecha
 * con una ola hasta su nivel y el monto cae letra a letra en el centro; al
 * confirmar, una lluvia de semillas antes de ir a /donar con el monto.
 * Grupo de radio accesible (flechas). Sin cifras de impacto inventadas.
 */
export function DonarAro({ titulo, llamado, montos }: { titulo: string; llamado: string; montos: readonly number[] }) {
  const [elegido, setElegido] = useState<number | null>(null)
  const liquidoRef = useRef<SVGGElement>(null)
  const montoRef = useRef<HTMLParagraphElement>(null)
  const raizRef = useRef<HTMLDivElement>(null)
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const idCorte = useId().replace(/:/g, '')
  const monto = elegido === null ? null : (montos[elegido] ?? null)

  // Nivel del líquido (y del SVG: superficie de 158 a 42).
  useEffect(() => {
    const g = liquidoRef.current
    if (!g) return
    const { gsap } = registrarGsap()
    const nivel = elegido === null ? 0.08 : (OBJETOS[elegido]?.nivel ?? 0.5)
    const y = 158 - nivel * 116
    if (prefiereMenosMovimiento()) gsap.set(g, { y })
    else gsap.to(g, { y, duration: 1.4, ease: 'elastic.out(1, 0.5)' })
    const p = montoRef.current
    if (p && elegido !== null && !prefiereMenosMovimiento()) {
      gsap.fromTo(
        p.querySelectorAll('[data-letra]'),
        { yPercent: -160, rotation: () => gsap.utils.random(-30, 30), opacity: 0 },
        { yPercent: 0, rotation: 0, opacity: 1, duration: 0.9, ease: 'bounce.out', stagger: 0.045 },
      )
    }
  }, [elegido])

  // La ola solo se mueve con la sección a la vista.
  useEffect(() => {
    const raiz = raizRef.current
    if (!raiz) return
    const io = new IntersectionObserver(([e]) => {
      raiz.dataset.visible = e?.isIntersecting ? 'si' : 'no'
    })
    io.observe(raiz)
    return () => io.disconnect()
  }, [])

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = montos.length
    const actual = elegido ?? -1
    let i: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (actual + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (actual - 1 + n) % n
    else return
    e.preventDefault()
    setElegido(i)
    botones.current[i]?.focus()
  }

  const texto = monto === null ? '' : formatoPesos(monto)
  return (
    <div ref={raizRef} className="donar-escena" data-visible="no">
      <div className="donar-cabeza">
        <h2 id="titulo-donar" data-lineas="" className="donar-titulo mega">
          <span className="l">
            <span className="l-in">Dona</span>
          </span>
          <span className="l donar-titulo-2">
            <span className="l-in">
              <span className="enfasis">{titulo.split(' ').slice(1).join(' ')}</span>
            </span>
          </span>
        </h2>
        <p data-rev="subir" className="donar-llamado">
          {llamado} Elige cuánto y mira cómo se llena el aro.
        </p>
      </div>

      <div className="donar-aro" aria-hidden="true">
        <svg viewBox="0 0 200 200" aria-hidden="true" className="donar-aro-svg">
          <defs>
            <clipPath id={`corte-${idCorte}`}>
              <circle cx="100" cy="100" r="58" />
            </clipPath>
          </defs>
          <circle cx="100" cy="100" r="58" className="donar-aro-fondo" />
          <g clipPath={`url(#corte-${idCorte})`}>
            <g ref={liquidoRef} transform="translate(0 149)">
              <g className="donar-ola">
                <path d="M0 8 Q50 0 100 8 T200 8 T300 8 T400 8 V220 H0Z" className="donar-liquido" />
              </g>
            </g>
          </g>
          <g transform="translate(-0 0) scale(2)" fill="none">
            <path d={ARO_D} className="donar-aro-trazo" strokeWidth="6" strokeLinecap="round" />
            <path d={PUNTA_D} className="donar-aro-punta" />
          </g>
        </svg>
        <p ref={montoRef} key={texto} className="donar-aro-monto">
          {monto === null ? (
            <span className="enfasis donar-aro-pregunta">¿Cuánto?</span>
          ) : (
            [...texto].map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: letras de una cifra.
              <span key={i} data-letra="" className="donar-aro-letra">
                {l}
              </span>
            ))
          )}
        </p>
      </div>

      <div className="donar-controles">
        <div role="radiogroup" aria-label="Monto sugerido" className="donar-objetos" onKeyDown={alTeclear}>
          {montos.map((valor, i) => {
            const o = OBJETOS[i] ?? OBJETOS[0]
            return (
              // biome-ignore lint/a11y/useSemanticElements: radio con forma de objeto (glifo + cifra); patrón ARIA completo con flechas.
              <button
                key={valor}
                ref={(el) => {
                  botones.current[i] = el
                }}
                type="button"
                role="radio"
                aria-checked={elegido === i}
                tabIndex={elegido === i || (elegido === null && i === 0) ? 0 : -1}
                onClick={() => setElegido(i)}
                className="donar-objeto"
              >
                <GlifoMonto i={i} />
                <span className="donar-objeto-nombre">{o.nombre}</span>
                <span className="donar-objeto-valor">{formatoPesos(valor)}</span>
              </button>
            )
          })}
        </div>
        <div className="donar-acciones">
          <Link
            href={monto === null ? '/donar' : `/donar?monto=${monto}`}
            data-seccion-tema="lima"
            data-cursor="Donar"
            className="donar-confirmar"
            onClick={(e) => {
              const c = e.currentTarget.getBoundingClientRect()
              lanzarSemillas(c.left + c.width / 2, c.top, { cantidad: 14, fuerza: 380 })
            }}
          >
            {monto === null ? 'Donar otro monto' : `Donar ${texto}`}
          </Link>
          <p className="donar-nota">Pago seguro en la pasarela: tus datos de tarjeta nunca pasan por este sitio.</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Valores: el valor que pasa por el centro de la pantalla se enciende (los
 * demás quedan atenuados). Solo con movimiento; sin él, todos plenos.
 */
export function ValoresVivo() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const lista = ref.current?.closest('section')?.querySelector('[data-valores-lista]')
    if (!lista) return
    const { gsap, ScrollTrigger } = registrarGsap()
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const triggers = [...lista.querySelectorAll<HTMLElement>('[data-valor]')].map((li) =>
        ScrollTrigger.create({
          trigger: li,
          start: 'center 53%',
          end: 'center 47%',
          toggleClass: { targets: li, className: 'activo' },
        }),
      )
      return () => {
        for (const t of triggers) t.kill()
      }
    })
    return () => mm.revert()
  }, [])
  return <span ref={ref} hidden />
}
