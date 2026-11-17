'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FlechaTrazo } from './flecha'
import { bloquearScroll, EASE, prefiereMenosMovimiento, registrarGsap } from './movimiento'

const SEGURIDAD_MS = 2500

/** Lo que dice la ola según a dónde vas: textos de sistema con voz. */
function fraseDestino(ruta: string) {
  if (ruta === '/') return 'Regresando a la vereda…'
  if (ruta.startsWith('/donar')) return 'Abriendo la alcancía…'
  if (ruta.startsWith('/legal')) return 'Buscando la letra menuda…'
  return 'Dando la vuelta…'
}

/**
 * E10 — Transición de página: una ola de color sube con la flecha girando
 * en el centro y una frase con voz; se navega con la ola cubriendo y se
 * retira cuando la ruta nueva ya pintó. Se anuncia el destino en una región
 * aria-live. Seguridad 2.5 s; con movimiento reducido, fundido de 250 ms.
 * Solo intercepta enlaces internos a OTRA ruta, sin modificadores ni _blank.
 */
export function Transicion() {
  const router = useRouter()
  const pathname = usePathname()
  const capaRef = useRef<HTMLDivElement>(null)
  const [frase, setFrase] = useState('')
  const cubierta = useRef(false)
  const seguridad = useRef(0)

  // Interceptar clics (fase de captura: antes que el onClick de <Link>).
  // biome-ignore lint/correctness/useExhaustiveDependencies: descubrir solo lee refs; el efecto se monta una vez.
  useEffect(() => {
    const { gsap } = registrarGsap()
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.sinTransicion !== undefined) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return // anclas de la misma página: las lleva Lenis
      const capa = capaRef.current
      if (!capa || cubierta.current) return
      e.preventDefault()
      e.stopPropagation()
      cubierta.current = true
      setFrase(fraseDestino(url.pathname))
      capa.dataset.activa = 'si'
      bloquearScroll(true)
      const destino = url.pathname + url.search + url.hash
      const navegar = () => router.push(destino)
      window.clearTimeout(seguridad.current)
      seguridad.current = window.setTimeout(descubrir, SEGURIDAD_MS + 900)
      if (prefiereMenosMovimiento()) {
        gsap.fromTo(capa, { opacity: 0 }, { opacity: 1, duration: 0.25, onComplete: navegar })
        return
      }
      gsap.set(capa, { opacity: 1 })
      gsap
        .timeline({ onComplete: navegar })
        .fromTo('[data-ola]', { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 0.7, ease: EASE.telon })
        .fromTo(
          '[data-ola-flecha]',
          { rotation: -180, scale: 0.4 },
          { rotation: 0, scale: 1, duration: 0.7, ease: EASE.salto },
          0.25,
        )
        .fromTo(
          '[data-ola-frase]',
          { yPercent: 100, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.5, ease: EASE.expoSalida },
          0.35,
        )
    }
    document.addEventListener('click', alClic, true)
    return () => document.removeEventListener('click', alClic, true)
  }, [router])

  // La ruta nueva pintó: retirar la ola hacia arriba.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reacciona al cambio de ruta.
  useEffect(() => {
    if (!cubierta.current) return
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(descubrir))
    return () => window.cancelAnimationFrame(id)
  }, [pathname])

  function descubrir() {
    const capa = capaRef.current
    window.clearTimeout(seguridad.current)
    if (!capa || !cubierta.current) return
    const { gsap } = registrarGsap()
    window.scrollTo(0, window.location.hash ? window.scrollY : 0)
    const fin = () => {
      cubierta.current = false
      capa.dataset.activa = 'no'
      gsap.set(['[data-ola]', capa], { clearProps: 'all' })
      bloquearScroll(false)
      window.dispatchEvent(new Event('proinserco:releer-nav'))
    }
    if (prefiereMenosMovimiento()) {
      gsap.to(capa, { opacity: 0, duration: 0.25, onComplete: fin })
      return
    }
    gsap
      .timeline({ onComplete: fin })
      .to('[data-ola-frase]', { yPercent: -60, opacity: 0, duration: 0.3, ease: EASE.entrada })
      .to('[data-ola-flecha]', { rotation: 360, duration: 0.8, ease: EASE.vuelta }, 0)
      .to('[data-ola]', { yPercent: -110, y: 0, duration: 0.8, ease: EASE.telon }, 0.15)
  }

  return (
    <div ref={capaRef} className="transicion" data-activa="no" aria-hidden={frase ? undefined : true}>
      <p className="sr-only" aria-live="polite">
        {frase}
      </p>
      <div data-ola="" data-seccion-tema="bosque" className="transicion-ola">
        <svg className="transicion-borde" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 120V60C120 20 240 0 360 20s240 80 360 80 240-60 360-80 240 20 360 60v40Z" fill="currentColor" />
        </svg>
        <div className="transicion-centro" aria-hidden="true">
          <FlechaTrazo data-ola-flecha="" grosor={10} className="transicion-flecha" />
          <p data-ola-frase="" className="transicion-frase">
            {frase}
          </p>
        </div>
      </div>
    </div>
  )
}
