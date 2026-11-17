'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { alSalirIntro, EASE, registrarGsap } from './movimiento'

/**
 * Motor de escena declarativo (adaptado de use-escena de Genix). Las
 * secciones son de servidor y solo DECLARAN atributos; aquí se anima:
 *
 *  data-rev="subir|izq|der|zoom|clip|giro|caer"  entrada al aparecer (siete
 *      vocabularios: se rotan entre secciones contiguas). data-rev-orden="n"
 *      escalona dentro de un grupo.
 *  data-lineas    titular con líneas enmascaradas (.l > .l-in) que suben.
 *  data-capa="v"  parallax con scrub (v>0 sube más rápido, v<0 se rezaga).
 *  data-contar    contador 0→valor al entrar (tabular).
 *  data-dibujar   trazo SVG que se dibuja al entrar (DrawSVG).
 *
 * Estados iniciales en CSS (sitio.css, bajo html[data-anim]) + fromTo: sin
 * destellos de SSR. Con movimiento reducido no hace nada (html[data-anim=no]).
 * Corre en todas las rutas públicas y se rehace al cambiar de ruta.
 */
const VARIANTES: Record<string, { de: gsap.TweenVars; ease: string; duracion: number }> = {
  subir: { de: { y: 70, opacity: 0 }, ease: EASE.expoSalida, duracion: 1 },
  izq: { de: { x: -140, rotation: -5, opacity: 0 }, ease: EASE.expoSalida, duracion: 1.1 },
  der: { de: { x: 140, rotation: 5, opacity: 0 }, ease: EASE.expoSalida, duracion: 1.1 },
  zoom: { de: { scale: 0.55, opacity: 0 }, ease: EASE.salto, duracion: 0.9 },
  clip: { de: { clipPath: 'inset(0% 100% 0% 0%)' }, ease: 'expo.inOut', duracion: 1.2 },
  giro: { de: { rotation: -14, scale: 0.7, opacity: 0 }, ease: 'elastic.out(1, 0.6)', duracion: 1.3 },
  caer: { de: { yPercent: -60, y: 0, rotation: 8, opacity: 0 }, ease: 'bounce.out', duracion: 1.1 },
}
const FINALES: gsap.TweenVars = { x: 0, y: 0, yPercent: 0, rotation: 0, scale: 1, opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }

export function Escena() {
  const pathname = usePathname()

  // biome-ignore lint/correctness/useExhaustiveDependencies: se rehace al cambiar de ruta.
  useEffect(() => {
    const { gsap, ScrollTrigger, SplitText } = registrarGsap()
    const html = document.documentElement
    const mm = gsap.matchMedia()
    let quitarIntro = () => {}

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      html.dataset.anim = 'activo'
      const ctx = gsap.context(() => {})
      quitarIntro = alSalirIntro(() => {
        ctx.add(() => {
          // ── Entradas por variante (en lotes: escalonado natural) ─────
          for (const [nombre, v] of Object.entries(VARIANTES)) {
            const elementos = gsap.utils.toArray<HTMLElement>(`[data-rev="${nombre}"]`)
            if (!elementos.length) continue
            ScrollTrigger.batch(elementos, {
              start: 'top 97%',
              once: true,
              onEnter: (lote) => {
                const orden = (lote as HTMLElement[]).sort(
                  (a, b) => Number(a.dataset.revOrden ?? 0) - Number(b.dataset.revOrden ?? 0),
                )
                gsap.fromTo(orden, v.de, {
                  ...FINALES,
                  duration: v.duracion,
                  ease: v.ease,
                  stagger: 0.09,
                  // Sin clearProps: el estado inicial vive en CSS y volvería.
                })
              },
            })
          }

          // ── Titulares por líneas enmascaradas ───────────────────────
          for (const titular of gsap.utils.toArray<HTMLElement>('[data-lineas]')) {
            const lineas = titular.querySelectorAll('.l-in')
            gsap.fromTo(
              lineas,
              // y: 0 explícito: GSAP lee el translateY(112%) del CSS inicial como y en px.
              { yPercent: 112, y: 0, rotation: 3 },
              {
                yPercent: 0,
                y: 0,
                rotation: 0,
                duration: 1.15,
                stagger: 0.1,
                ease: 'power4.out',
                scrollTrigger: { trigger: titular, start: 'top 86%', once: true },
              },
            )
          }

          // ── Parallax por capas ───────────────────────────────────────
          for (const capa of gsap.utils.toArray<HTMLElement>('[data-capa]')) {
            const v = Number(capa.dataset.capa) || 0.1
            gsap.fromTo(
              capa,
              { yPercent: v * 60 },
              {
                yPercent: -v * 60,
                ease: 'none',
                scrollTrigger: { trigger: capa.parentElement ?? capa, start: 'top bottom', end: 'bottom top', scrub: true },
              },
            )
          }

          // ── Contadores ───────────────────────────────────────────────
          for (const el of gsap.utils.toArray<HTMLElement>('[data-contar]')) {
            const final = Number(el.dataset.contar) || 0
            const ancho = el.dataset.contarAncho ? Number(el.dataset.contarAncho) : 0
            const estado = { v: 0 }
            const pintar = () => {
              el.textContent = String(Math.round(estado.v)).padStart(ancho, '0')
            }
            pintar()
            gsap.to(estado, {
              v: final,
              duration: 1.8,
              ease: 'power2.out',
              onUpdate: pintar,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            })
          }

          // ── Párrafo que se enciende palabra a palabra con el scroll ──
          for (const parrafo of gsap.utils.toArray<HTMLElement>('[data-texto-luz]')) {
            SplitText.create(parrafo, {
              type: 'words',
              autoSplit: true,
              onSplit: (self) =>
                gsap.fromTo(
                  self.words,
                  { opacity: 0.14 },
                  {
                    opacity: 1,
                    stagger: 0.1,
                    ease: 'none',
                    scrollTrigger: { trigger: parrafo, start: 'top 80%', end: 'bottom 55%', scrub: true },
                  },
                ),
            })
          }

          // ── Trazos que se dibujan ────────────────────────────────────
          for (const trazo of gsap.utils.toArray<SVGPathElement>('[data-dibujar]')) {
            gsap.fromTo(
              trazo,
              { drawSVG: '0%' },
              {
                drawSVG: '100%',
                duration: Number(trazo.dataset.dibujar) || 1.6,
                ease: 'power2.inOut',
                scrollTrigger: { trigger: trazo.closest('svg') ?? trazo, start: 'top 85%', once: true },
              },
            )
          }
        })
        ScrollTrigger.refresh()
      })
      return () => {
        quitarIntro()
        ctx.revert()
      }
    })
    mm.add('(prefers-reduced-motion: reduce)', () => {
      html.dataset.anim = 'no'
    })

    // Fuentes e imágenes listas → posiciones nuevas.
    const refrescar = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refrescar)
    window.addEventListener('load', refrescar)

    return () => {
      window.removeEventListener('load', refrescar)
      mm.revert()
    }
  }, [pathname])

  return null
}
