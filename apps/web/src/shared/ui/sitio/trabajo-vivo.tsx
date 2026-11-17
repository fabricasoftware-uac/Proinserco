'use client'

import { useEffect, useRef } from 'react'
import { CONSULTA_ESCRITORIO, registrarGsap } from './movimiento'

const CON_MOVIMIENTO = '(prefers-reduced-motion: no-preference)'

/** Capacitaciones: la barra del resultado se llena al entrar (scaleX). */
export function SemilleroVivo() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const barra = ref.current?.closest('section')?.querySelector<HTMLElement>('[data-capa-barra]')
    if (!barra) return
    const { gsap } = registrarGsap()
    const mm = gsap.matchMedia()
    mm.add(CON_MOVIMIENTO, () => {
      gsap.fromTo(
        barra,
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: '0% 50%',
          duration: 1.6,
          ease: 'power3.out',
          scrollTrigger: { trigger: barra, start: 'top 85%', once: true },
        },
      )
    })
    return () => mm.revert()
  }, [])
  return <span ref={ref} hidden />
}

const ENTRADAS_PARADA: Record<string, { de: gsap.TweenVars; a: gsap.TweenVars; ease: string }> = {
  clip: { de: { clipPath: 'inset(0% 100% 0% 0%)' }, a: { clipPath: 'inset(0% 0% 0% 0%)' }, ease: 'expo.inOut' },
  giro: { de: { rotation: -14, scale: 0.7, opacity: 0 }, a: { rotation: -3, scale: 1, opacity: 1 }, ease: 'elastic.out(1, 0.6)' },
  caer: { de: { yPercent: -50, rotation: 8, opacity: 0 }, a: { yPercent: 0, rotation: 2.5, opacity: 1 }, ease: 'bounce.out' },
}

/** Territorio: pista horizontal, ruta que se dibuja y flecha viajera (escritorio). */
export function TerritorioVivo() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const seccion = ref.current?.closest<HTMLElement>('#territorio')
    if (!seccion) return
    const { gsap } = registrarGsap()
    const pista = seccion.querySelector<HTMLElement>('[data-terri-pista]')
    const ruta = seccion.querySelector<SVGPathElement>('[data-terri-ruta]')
    const viajera = seccion.querySelector<HTMLElement>('[data-terri-viajera]')
    const mm = gsap.matchMedia()
    mm.add(`${CONSULTA_ESCRITORIO} and ${CON_MOVIMIENTO}`, () => {
      if (!pista || !ruta || !viajera) return
      const largo = ruta.getTotalLength()
      const recorrido = () => Math.max(0, pista.scrollWidth - window.innerWidth)
      const estado = { p: 0 }
      const pintarViajera = () => {
        const pt = ruta.getPointAtLength(largo * estado.p)
        const x = (pt.x / 4400) * pista.scrollWidth - estado.p * recorrido()
        const y = (pt.y / 1000) * pista.offsetHeight
        gsap.set(viajera, { x, y, rotation: -estado.p * 1440 })
      }
      const tl = gsap.timeline({
        scrollTrigger: { trigger: seccion, start: 'top top', end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true },
      })
      tl.fromTo(pista, { x: 0 }, { x: () => -recorrido(), ease: 'none', duration: 1 }, 0)
        .fromTo(ruta, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', duration: 1 }, 0)
        .fromTo(estado, { p: 0 }, { p: 1, ease: 'none', duration: 1, onUpdate: pintarViajera }, 0)
      for (const capa of pista.querySelectorAll<SVGElement>('[data-terri-capa]')) {
        const v = Number(capa.getAttribute('data-terri-capa')) || 0
        tl.fromTo(capa, { xPercent: 0 }, { xPercent: v * 20, ease: 'none', duration: 1 }, 0)
      }
      pintarViajera()
      // Cada parada entra al cruzar el borde derecho (containerAnimation), con su propio vocabulario.
      for (const foto of pista.querySelectorAll<HTMLElement>('[data-terri-rev]')) {
        const v = ENTRADAS_PARADA[foto.dataset.terriRev ?? 'clip'] ?? ENTRADAS_PARADA.clip
        gsap.fromTo(foto, v?.de ?? {}, {
          ...v?.a,
          duration: 1.2,
          ease: v?.ease ?? 'expo.out',
          scrollTrigger: { trigger: foto, containerAnimation: tl, start: 'left 85%', toggleActions: 'play none none reverse' },
        })
      }
      return () => gsap.set([pista, viajera], { clearProps: 'transform' })
    })
    mm.add(`(max-width: 1023.98px) and ${CON_MOVIMIENTO}`, () => {
      for (const foto of seccion.querySelectorAll<HTMLElement>('[data-terri-rev]')) {
        const v = ENTRADAS_PARADA[foto.dataset.terriRev ?? 'clip'] ?? ENTRADAS_PARADA.clip
        gsap.fromTo(foto, v?.de ?? {}, {
          ...v?.a,
          duration: 1.1,
          ease: v?.ease ?? 'expo.out',
          scrollTrigger: { trigger: foto, start: 'top 85%', once: true },
        })
      }
    })
    return () => mm.revert()
  }, [])
  return <span ref={ref} hidden />
}
