'use client'

import { useEffect, useRef } from 'react'
import { CONSULTA_PUNTERO_FINO, lanzarSemillas, prefiereMenosMovimiento, registrarGsap } from './movimiento'

const INTERACTIVOS = 'a[href], button, [role="button"], [role="tab"], summary, label[for], [data-cursor]'
const CAMPOS = 'input, textarea, select, [contenteditable="true"]'

/**
 * E10 — Cursor: un aro lima con inercia y un punto exacto. Crece sobre lo
 * que se puede pulsar, muestra una palabra donde hay [data-cursor], se
 * aplasta al pulsar y suelta semillas con gravedad al hacer clic. Solo con
 * puntero fino y sin movimiento reducido; desaparece sobre campos de texto
 * (allí manda el cursor del sistema, que nunca se oculta).
 */
export function Cursor() {
  const aroRef = useRef<HTMLDivElement>(null)
  const puntoRef = useRef<HTMLDivElement>(null)
  const textoRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const aro = aroRef.current
    const punto = puntoRef.current
    const texto = textoRef.current
    if (!aro || !punto || !texto) return
    if (!window.matchMedia(CONSULTA_PUNTERO_FINO).matches || prefiereMenosMovimiento()) return
    const { gsap } = registrarGsap()

    const ax = gsap.quickTo(aro, 'x', { duration: 0.45, ease: 'power3.out' })
    const ay = gsap.quickTo(aro, 'y', { duration: 0.45, ease: 'power3.out' })
    const px = gsap.quickSetter(punto, 'x', 'px')
    const py = gsap.quickSetter(punto, 'y', 'px')
    let visible = false
    let estado: 'libre' | 'enlace' | 'texto' | 'campo' = 'libre'

    const aplicar = (nuevo: typeof estado, palabra = '') => {
      if (nuevo === estado && palabra === texto.textContent) return
      estado = nuevo
      texto.textContent = palabra
      document.documentElement.dataset.cursorEstado = nuevo
      const escala = nuevo === 'texto' ? 2.5 : nuevo === 'enlace' ? 1.7 : 1
      gsap.to(aro, { scale: escala, opacity: nuevo === 'campo' ? 0 : 1, duration: 0.45, ease: 'salto', overwrite: 'auto' })
      gsap.to(punto, { scale: nuevo === 'libre' ? 1 : 0, opacity: nuevo === 'campo' ? 0 : 1, duration: 0.25, overwrite: 'auto' })
    }

    const mover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (!visible) {
        visible = true
        gsap.set([aro, punto], { x: e.clientX, y: e.clientY })
        gsap.to([aro, punto], { autoAlpha: 1, duration: 0.25 })
      }
      ax(e.clientX)
      ay(e.clientY)
      px(e.clientX)
      py(e.clientY)
    }
    const sobre = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null
      if (!el) return
      if (el.closest(CAMPOS)) return aplicar('campo')
      const conTexto = el.closest<HTMLElement>('[data-cursor]')
      if (conTexto?.dataset.cursor) return aplicar('texto', conTexto.dataset.cursor)
      if (el.closest(INTERACTIVOS)) return aplicar('enlace')
      aplicar('libre')
    }
    const pulsar = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      gsap.to(aro, { scaleX: '*=1.18', scaleY: '*=0.78', duration: 0.12, ease: 'power2.out', overwrite: false })
    }
    const soltar = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const escala = estado === 'texto' ? 2.5 : estado === 'enlace' ? 1.7 : 1
      gsap.to(aro, { scaleX: escala, scaleY: escala, duration: 0.5, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' })
      if (estado !== 'campo') lanzarSemillas(e.clientX, e.clientY, { cantidad: 6, fuerza: 240 })
    }
    const salir = () => {
      visible = false
      gsap.to([aro, punto], { autoAlpha: 0, duration: 0.2 })
    }

    window.addEventListener('pointermove', mover, { passive: true })
    document.addEventListener('pointerover', sobre, { passive: true })
    window.addEventListener('pointerdown', pulsar, { passive: true })
    window.addEventListener('pointerup', soltar, { passive: true })
    document.documentElement.addEventListener('pointerleave', salir)
    return () => {
      window.removeEventListener('pointermove', mover)
      document.removeEventListener('pointerover', sobre)
      window.removeEventListener('pointerdown', pulsar)
      window.removeEventListener('pointerup', soltar)
      document.documentElement.removeEventListener('pointerleave', salir)
      delete document.documentElement.dataset.cursorEstado
    }
  }, [])

  return (
    <div aria-hidden="true" className="cursor-capa">
      <div ref={aroRef} className="cursor-aro">
        <span ref={textoRef} className="cursor-texto" />
      </div>
      <div ref={puntoRef} className="cursor-punto" />
    </div>
  )
}
