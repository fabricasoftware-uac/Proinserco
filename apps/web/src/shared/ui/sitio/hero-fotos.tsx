'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { prefiereMenosMovimiento } from './movimiento'

type Foto = { src: string; alt: string }

const CADA_MS = 6500
const SIZES = '(max-width: 767px) 360vw, (max-width: 1199px) 210vw, 115vw'

/**
 * Fotos del hero que se relevan solas con un fundido lento y un acercamiento
 * suave (solo opacity/transform, sin saltos de layout: todas las capas son
 * absolutas y del mismo tamaño). La primera carga con prioridad; las demás
 * se montan cuando la página terminó de cargar. Se detiene fuera de
 * pantalla, con la pestaña oculta y con movimiento reducido (queda la
 * primera). Las fotos de relevo son decorativas: el alt lo lleva la primera.
 */
export function HeroFotos({ fotos }: { fotos: readonly Foto[] }) {
  const [resto, setResto] = useState(false)
  const [activa, setActiva] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const visible = useRef(true)

  // Diferido: el resto de fotos se monta tras la carga completa.
  useEffect(() => {
    if (prefiereMenosMovimiento()) return
    const montar = () => window.setTimeout(() => setResto(true), 600)
    if (document.readyState === 'complete') {
      const t = montar()
      return () => window.clearTimeout(t)
    }
    window.addEventListener('load', montar, { once: true })
    return () => window.removeEventListener('load', montar)
  }, [])

  // Pausa fuera de pantalla.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      visible.current = Boolean(e?.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!resto) return
    const id = window.setInterval(() => {
      if (!visible.current || document.hidden) return
      setActiva((a) => (a + 1) % fotos.length)
    }, CADA_MS)
    return () => window.clearInterval(id)
  }, [resto, fotos.length])

  return (
    <div ref={ref} data-hero-deriva-foto="" className="hero-fotos">
      {fotos.map((f, i) =>
        i === 0 || resto ? (
          <div key={f.src} className="hero-foto-capa" data-activa={i === activa ? 'si' : 'no'}>
            <Image
              src={f.src}
              alt={i === 0 ? f.alt : ''}
              fill
              priority={i === 0}
              loading={i === 0 ? undefined : 'lazy'}
              sizes={SIZES}
              quality={85}
              className="object-cover"
            />
          </div>
        ) : null,
      )}
    </div>
  )
}
