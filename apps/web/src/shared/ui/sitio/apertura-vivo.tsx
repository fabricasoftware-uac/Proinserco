'use client'

import { useEffect, useRef } from 'react'
import { CONSULTA_ESCRITORIO, CONSULTA_PUNTERO_FINO, registrarGsap } from './movimiento'

/** Centro de `el` en coordenadas de `raiz` con offsetLeft/Top: ignora transformaciones (vale a mitad de scroll). */
function centroEn(el: HTMLElement, raiz: HTMLElement) {
  let x = el.offsetWidth / 2
  let y = el.offsetHeight / 2
  let n: HTMLElement | null = el
  while (n && n !== raiz) {
    x += n.offsetLeft
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  if (n !== raiz) {
    x -= raiz.offsetLeft
    y -= raiz.offsetTop
  }
  return `${x}px ${y}px`
}

/**
 * Hero: la cámara entra por la "O"-flecha dando la vuelta (scrub), la capa
 * oscura se retira y la foto queda a plena luz; parallax de ratón por capas
 * con quickTo (titular y foto en sentidos opuestos).
 */
export function HeroVivo() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const hero = ref.current?.closest<HTMLElement>('[data-hero]')
    if (!hero) return
    const { gsap } = registrarGsap()
    const q = (s: string) => hero.querySelector<HTMLElement>(s)
    const letras = q('[data-hero-letras]')
    const o = q('[data-hero-o]')
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!letras || !o) return
      const origen = () => centroEn(o, letras)
      gsap
        .timeline({
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true },
        })
        .to(q('[data-hero-sale]'), { opacity: 0, y: -40, duration: 0.14, ease: 'none' }, 0)
        .fromTo(
          letras,
          { scale: 1, transformOrigin: origen },
          { scale: 32, transformOrigin: origen, ease: 'power3.in', duration: 1 },
          0.04,
        )
        .fromTo(q('[data-hero-o-flecha]'), { rotation: 0 }, { rotation: -300, ease: 'power1.in', duration: 1 }, 0.04)
        .fromTo(q('[data-hero-foto]'), { scale: 1.12 }, { scale: 1, ease: 'none', duration: 1 }, 0)
        .to(q('[data-hero-capa]'), { opacity: 0, duration: 0.14, ease: 'none' }, 0.86)
    })
    mm.add(`${CONSULTA_PUNTERO_FINO} and ${CONSULTA_ESCRITORIO} and (prefers-reduced-motion: no-preference)`, () => {
      const deriva = q('[data-hero-deriva]')
      const foto = q('[data-hero-deriva-foto]')
      if (!deriva || !foto) return
      const dx = gsap.quickTo(deriva, 'x', { duration: 1.1, ease: 'power3.out' })
      const dy = gsap.quickTo(deriva, 'y', { duration: 1.1, ease: 'power3.out' })
      const fx = gsap.quickTo(foto, 'x', { duration: 1.4, ease: 'power3.out' })
      const fy = gsap.quickTo(foto, 'y', { duration: 1.4, ease: 'power3.out' })
      const mover = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5
        const ny = e.clientY / window.innerHeight - 0.5
        dx(nx * 22)
        dy(ny * 14)
        fx(-nx * 34)
        fy(-ny * 20)
      }
      hero.addEventListener('pointermove', mover)
      return () => hero.removeEventListener('pointermove', mover)
    })
    return () => mm.revert()
  }, [])
  return <span ref={ref} hidden />
}

/**
 * Qué hacemos: la cinta de verbos corre con el scroll y una persiana de
 * barras bosque se cierra sobre ella (cada barra lleva data-nav: el navbar
 * cambia cuando la cubren). En móvil, tarjetas apiladas: cada una tapa a la
 * anterior, que se encoge.
 */
export function HacemosVivo() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const seccion = ref.current?.closest<HTMLElement>('#que-hacemos')
    if (!seccion) return
    const { gsap } = registrarGsap()
    const persiana = seccion.querySelector<HTMLElement>('[data-hacemos-persiana]')
    const barras = gsap.utils.toArray<HTMLElement>('[data-hacemos-barra]', seccion)
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!persiana) return
      barras.forEach((b, i) => {
        gsap.set(b, { transformOrigin: i % 2 ? '50% 0%' : '50% 100%' })
      })
      gsap
        .timeline({ scrollTrigger: { trigger: persiana, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } })
        .fromTo('[data-hacemos-cinta]', { xPercent: 4 }, { xPercent: -38, ease: 'none', duration: 1 }, 0)
        .fromTo(
          barras,
          { scaleY: 0 },
          { scaleY: 1, ease: 'power2.inOut', duration: 0.3, stagger: { each: 0.03, from: 'random' } },
          0.62,
        )
    })
    // Frente activo (escritorio): el panel de la derecha muestra su foto y su descripción.
    const items = [...seccion.querySelectorAll<HTMLElement>('[data-hacemos-item]')]
    const activar = (el: HTMLElement) => {
      for (const it of items) it.dataset.activo = it === el ? 'si' : 'no'
    }
    const quitar: (() => void)[] = []
    for (const it of items) {
      const fn = () => activar(it)
      it.addEventListener('pointerenter', fn)
      it.addEventListener('focusin', fn)
      quitar.push(() => {
        it.removeEventListener('pointerenter', fn)
        it.removeEventListener('focusin', fn)
      })
    }
    mm.add('(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)', () => {
      const items = gsap.utils.toArray<HTMLElement>('[data-hacemos-item]', seccion)
      items.forEach((item, i) => {
        const siguiente = items[i + 1]
        if (!siguiente) return
        gsap.fromTo(
          item,
          { scale: 1, rotation: 0 },
          {
            scale: 0.9,
            rotation: i % 2 ? 2 : -2,
            ease: 'none',
            scrollTrigger: { trigger: siguiente, start: 'top bottom', end: 'top 20%', scrub: true },
          },
        )
      })
    })
    return () => {
      for (const q of quitar) q()
      mm.revert()
    }
  }, [])
  return <span ref={ref} hidden />
}
