'use client'

import { useEffect, useRef } from 'react'
import { CONSULTA_PUNTERO_FINO, lanzarSemillas, prefiereMenosMovimiento, registrarGsap } from './movimiento'

/**
 * Titular con letras que se apartan del cursor (adaptado del wordmark
 * reactivo de Inventia/Genix): quickTo por letra en x, y y giro con caída
 * (1 − d/R)^1.5. Centros medidos al ENTRAR el puntero, no en cada
 * movimiento. En táctil, un toque hace saltar las letras en onda.
 */
const RADIO = 240
const EMPUJE = 34
const GIRO = 18

export function LetrasReactivas({ texto, className }: { texto: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const raiz = ref.current
    if (!raiz || prefiereMenosMovimiento()) return
    const { gsap } = registrarGsap()
    const letras = [...raiz.querySelectorAll<HTMLElement>('[data-letra]')]
    const fino = window.matchMedia(CONSULTA_PUNTERO_FINO).matches

    if (!fino) {
      const onda = () =>
        gsap.fromTo(
          letras,
          { y: 0 },
          { y: -18, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1, stagger: { each: 0.025, from: 'start' } },
        )
      raiz.addEventListener('click', onda)
      return () => raiz.removeEventListener('click', onda)
    }

    const tos = letras.map((l) => ({
      x: gsap.quickTo(l, 'x', { duration: 0.65, ease: 'power3.out' }),
      y: gsap.quickTo(l, 'y', { duration: 0.65, ease: 'power3.out' }),
      r: gsap.quickTo(l, 'rotation', { duration: 0.7, ease: 'power3.out' }),
    }))
    let centros: { x: number; y: number }[] = []
    const medir = () => {
      centros = letras.map((l) => {
        const c = l.getBoundingClientRect()
        const t = gsap.getProperty(l, 'x') as number
        const u = gsap.getProperty(l, 'y') as number
        return { x: c.left + c.width / 2 - t, y: c.top + c.height / 2 - u }
      })
    }
    const mover = (e: PointerEvent) => {
      if (!centros.length) medir()
      centros.forEach((c, i) => {
        const dx = c.x - e.clientX
        const dy = c.y - e.clientY
        const d = Math.hypot(dx, dy)
        const t = tos[i]
        if (!t) return
        if (d > RADIO) {
          t.x(0)
          t.y(0)
          t.r(0)
          return
        }
        const f = (1 - d / RADIO) ** 1.5
        t.x((dx / (d || 1)) * EMPUJE * f)
        t.y((dy / (d || 1)) * EMPUJE * f)
        t.r((dx > 0 ? 1 : -1) * GIRO * f)
      })
    }
    const entrar = () => medir()
    const salir = () => {
      for (const t of tos) {
        t.x(0)
        t.y(0)
        t.r(0)
      }
    }
    const zona = raiz.parentElement ?? raiz
    zona.addEventListener('pointerenter', entrar)
    zona.addEventListener('pointermove', mover)
    zona.addEventListener('pointerleave', salir)
    window.addEventListener('scroll', entrar, { passive: true })
    return () => {
      zona.removeEventListener('pointerenter', entrar)
      zona.removeEventListener('pointermove', mover)
      zona.removeEventListener('pointerleave', salir)
      window.removeEventListener('scroll', entrar)
    }
  }, [])

  // "*palabra*" = palabra pequeña de énfasis en serif itálica.
  const palabras = texto.split(' ')
  return (
    <h2 ref={ref} className={className} aria-label={texto.replaceAll('*', '')}>
      {palabras.map((p, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: posición fija de cada palabra del titular.
          key={`${p}-${i}`}
          aria-hidden="true"
          className={p.startsWith('*') ? 'pie-palabra pie-palabra-enfasis' : 'pie-palabra'}
        >
          {[...p.replaceAll('*', '')].map((l, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: letras de un texto fijo.
            <span key={`${l}-${j}`} data-letra="" className="pie-letra">
              {l}
            </span>
          ))}
        </span>
      ))}
    </h2>
  )
}

/**
 * Franja de siembra al pie: al pasar el ratón brotan matas cada 90 px
 * (máximo 12 a la vez) y se marchitan solas; al hacer clic, semillas con
 * gravedad. En táctil, un toque siembra una mata. Nodos efímeros fuera de
 * React con retiro garantizado.
 */
export function FranjaSiembra() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const franja = ref.current
    if (!franja || prefiereMenosMovimiento()) return
    const { gsap } = registrarGsap()
    let ultimoX = -999
    let vivas = 0

    const sembrar = (clientX: number) => {
      if (vivas >= 12) return
      const caja = franja.getBoundingClientRect()
      const x = clientX - caja.left
      const mata = document.createElement('span')
      mata.className = `mata mata-${Math.floor(Math.random() * 3)}`
      franja.appendChild(mata)
      vivas++
      gsap.set(mata, {
        x,
        xPercent: -50,
        scaleY: 0,
        scaleX: 0.6,
        rotation: gsap.utils.random(-12, 12),
        transformOrigin: '50% 100%',
      })
      gsap
        .timeline({
          onComplete: () => {
            mata.remove()
            vivas--
          },
        })
        .to(mata, { scaleY: gsap.utils.random(0.7, 1.15), scaleX: 1, duration: 0.6, ease: 'salto' })
        .to(mata, { rotation: '+=6', duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: 1 })
        .to(mata, { scaleY: 0, opacity: 0, duration: 0.5, ease: 'power2.in' })
      window.setTimeout(() => {
        if (!mata.isConnected) return
        mata.remove()
        vivas--
      }, 6000)
    }
    const mover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (Math.abs(e.clientX - ultimoX) < 90) return
      ultimoX = e.clientX
      sembrar(e.clientX)
    }
    const pulsar = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') lanzarSemillas(e.clientX, e.clientY, { cantidad: 7, fuerza: 300 })
      else sembrar(e.clientX)
    }
    franja.addEventListener('pointermove', mover)
    franja.addEventListener('pointerdown', pulsar)
    return () => {
      franja.removeEventListener('pointermove', mover)
      franja.removeEventListener('pointerdown', pulsar)
      franja.textContent = ''
    }
  }, [])

  return (
    <div ref={ref} className="franja-siembra" aria-hidden="true">
      <span className="franja-siembra-suelo" />
    </div>
  )
}

/** Cordilleras con distinta velocidad y la flecha de la ventana girando con el scroll. */
export function PieVivo() {
  useEffect(() => {
    const { gsap } = registrarGsap()
    const pie = document.querySelector<HTMLElement>('footer[data-pie]')
    if (!pie) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      for (const c of pie.querySelectorAll<SVGElement>('[data-cordillera]')) {
        const v = Number(c.getAttribute('data-cordillera')) || 0
        gsap.fromTo(
          c,
          { yPercent: 40 + v * 60 },
          { yPercent: 0, ease: 'none', scrollTrigger: { trigger: pie, start: 'top bottom', end: 'top 30%', scrub: 0.6 } },
        )
      }
      const flecha = pie.querySelector('[data-pie-flecha]')
      if (flecha)
        gsap.fromTo(
          flecha,
          { rotation: -200 },
          { rotation: 0, ease: 'none', scrollTrigger: { trigger: pie, start: 'top bottom', end: 'bottom bottom', scrub: 0.8 } },
        )
    })
    return () => mm.revert()
  }, [])
  return null
}
