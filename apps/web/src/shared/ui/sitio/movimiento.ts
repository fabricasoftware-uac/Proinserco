'use client'

import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import type Lenis from 'lenis'

/**
 * Utilidades de movimiento del sitio público. SOLO cliente: GSAP no se
 * importa desde componentes de servidor.
 */
let registrado = false
export function registrarGsap() {
  if (!registrado && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, Physics2DPlugin, CustomEase)
    // Curvas propias del mundo "dar la vuelta".
    CustomEase.create('telon', '0.76,0,0.24,1') // cortinas y círculos que cubren: firme y simétrica
    CustomEase.create('salto', '0.34,1.56,0.64,1') // rebasa y vuelve: botones, pegatinas, letras
    CustomEase.create('vuelta', 'M0,0 C0.18,0 0.2,1.12 0.52,1.06 0.74,1.02 0.8,1 1,1') // giro con inercia
    registrado = true
  }
  return { gsap, ScrollTrigger, SplitText }
}

/** Curvas GSAP (las CSS equivalentes viven en los tokens). */
export const EASE = {
  salida: 'power3.out',
  expoSalida: 'expo.out',
  entradaSalida: 'power3.inOut',
  entrada: 'power3.in',
  telon: 'telon',
  salto: 'salto',
  vuelta: 'vuelta',
} as const

export const CONSULTA_ESCRITORIO = '(min-width: 1024px)'
export const CONSULTA_REDUCIDO = '(prefers-reduced-motion: reduce)'
export const CONSULTA_PUNTERO_FINO = '(hover: hover) and (pointer: fine)'

let lenisActual: Lenis | null = null
export function fijarLenis(l: Lenis | null) {
  lenisActual = l
}
export function obtenerLenis() {
  return lenisActual
}

export function prefiereMenosMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia(CONSULTA_REDUCIDO).matches
}

/** Curva simétrica: la de Lenis por defecto "salta" en recorridos largos (Gotchas). */
const curvaSimetrica = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

function posicionDe(destino: number | HTMLElement) {
  return typeof destino === 'number' ? destino : destino.getBoundingClientRect().top + window.scrollY
}

/** Desplaza con duración proporcional a la distancia; salto inmediato con movimiento reducido. */
export function desplazarA(destino: number | HTMLElement, alTerminar?: () => void) {
  const lenis = lenisActual
  const y = posicionDe(destino)
  if (!lenis || prefiereMenosMovimiento()) {
    window.scrollTo({ top: y, behavior: 'auto' })
    alTerminar?.()
    return
  }
  const distancia = Math.abs(y - window.scrollY)
  const duracion = Math.min(3.2, Math.max(1.1, 0.9 + distancia / 3500))
  lenis.scrollTo(y, { duration: duracion, easing: curvaSimetrica, force: true, onComplete: () => alTerminar?.() })
}

/** Lleva a un ancla de la página actual y deja el foco en ella (sin mover el scroll otra vez). */
export function irAAncla(id: string) {
  const destino = document.getElementById(id)
  if (!destino) return false
  desplazarA(destino, () => {
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
    destino.focus({ preventScroll: true })
  })
  history.replaceState(null, '', `#${id}`)
  return true
}

/** Bloqueo de scroll sin salto (html tiene scrollbar-gutter: stable). */
export function bloquearScroll(bloquear: boolean) {
  const lenis = lenisActual
  document.documentElement.style.overflow = bloquear ? 'hidden' : ''
  if (lenis) {
    if (bloquear) lenis.stop()
    else lenis.start()
  }
}

/** Evento que el loader dispara cuando EMPIEZA a destapar el sitio (la portada entra entonces). */
export const EVENTO_SALIDA_INTRO = 'proinserco:intro-salida'

/** Ejecuta `fn` cuando la intro empieza a salir (o ya, si no hay intro). Devuelve la limpieza. */
export function alSalirIntro(fn: () => void, seguridadMs = 9000) {
  const html = document.documentElement
  if (html.dataset.intro !== 'si') {
    fn()
    return () => {}
  }
  let hecho = false
  const una = () => {
    if (hecho) return
    hecho = true
    window.clearTimeout(t)
    fn()
  }
  const t = window.setTimeout(una, seguridadMs)
  window.addEventListener(EVENTO_SALIDA_INTRO, una, { once: true })
  return () => {
    window.clearTimeout(t)
    window.removeEventListener(EVENTO_SALIDA_INTRO, una)
  }
}

/**
 * Lanza semillas/hojas efímeras con física desde un punto de la pantalla
 * (clic del cursor, botón de subir, confirmar un monto). Nodos fuera de
 * React, en una capa fija, con retiro garantizado. Sin movimiento reducido.
 */
export function lanzarSemillas(
  x: number,
  y: number,
  { cantidad = 6, fuerza = 260, tipo = 'semilla' }: { cantidad?: number; fuerza?: number; tipo?: 'semilla' | 'hoja' } = {},
) {
  if (prefiereMenosMovimiento()) return
  const { gsap } = registrarGsap()
  let capa = document.getElementById('capa-semillas')
  if (!capa) {
    capa = document.createElement('div')
    capa.id = 'capa-semillas'
    capa.setAttribute('aria-hidden', 'true')
    capa.className = 'capa-semillas'
    document.body.appendChild(capa)
  }
  for (let i = 0; i < cantidad; i++) {
    const n = document.createElement('span')
    n.className = tipo === 'hoja' ? 'semilla semilla-hoja' : 'semilla'
    capa.appendChild(n)
    gsap.set(n, { x, y, xPercent: -50, yPercent: -50, rotation: gsap.utils.random(0, 360), scale: gsap.utils.random(0.6, 1.15) })
    const vida = gsap.utils.random(0.8, 1.3)
    gsap.to(n, {
      duration: vida,
      physics2D: { velocity: gsap.utils.random(fuerza * 0.5, fuerza), angle: gsap.utils.random(-150, -30), gravity: 900 },
      rotation: `+=${gsap.utils.random(-260, 260)}`,
      ease: 'none',
    })
    gsap.to(n, { opacity: 0, duration: 0.3, delay: vida - 0.3, onComplete: () => n.remove() })
    window.setTimeout(() => n.remove(), (vida + 0.6) * 1000)
  }
}
