'use client'

import Lenis from 'lenis'
import { useEffect } from 'react'
import { CONSULTA_REDUCIDO, fijarLenis, registrarGsap } from './movimiento'

/**
 * Scroll suave con Lenis sincronizado con ScrollTrigger sobre el ticker de
 * GSAP (un solo reloj). Con movimiento reducido no hay Lenis: scroll nativo.
 * `anchors: false`: las anclas las gestiona irAAncla (Gotchas: Lenis compite
 * por los enlaces del menú).
 */
export function ProveedorMovimiento() {
  useEffect(() => {
    const { gsap, ScrollTrigger } = registrarGsap()
    const consulta = window.matchMedia(CONSULTA_REDUCIDO)
    let lenis: Lenis | null = null
    const alTick = (tiempo: number) => lenis?.raf(tiempo * 1000)

    const montar = () => {
      if (consulta.matches || lenis) return
      lenis = new Lenis({ autoRaf: false, anchors: false, lerp: 0.11, wheelMultiplier: 1 })
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(alTick)
      gsap.ticker.lagSmoothing(0)
      fijarLenis(lenis)
    }
    const desmontar = () => {
      gsap.ticker.remove(alTick)
      lenis?.destroy()
      lenis = null
      fijarLenis(null)
    }
    const alCambiar = () => (consulta.matches ? desmontar() : montar())

    montar()
    consulta.addEventListener('change', alCambiar)
    return () => {
      consulta.removeEventListener('change', alCambiar)
      desmontar()
    }
  }, [])

  return null
}
