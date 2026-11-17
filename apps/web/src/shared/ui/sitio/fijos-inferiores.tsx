'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FlechaTrazo } from './flecha'
import { desplazarA, EASE, lanzarSemillas, prefiereMenosMovimiento, registrarGsap } from './movimiento'

/**
 * Fijos inferiores, en la zona del pulgar y en UNA sola fila:
 *  - "Donar" (móvil y tableta): píldora lima protagonista que respira; nunca
 *    se esconde salvo dentro del flujo /donar.
 *  - "Ir arriba": la flecha de la marca con el progreso de la página como
 *    anillo; al pulsarla despega dando la vuelta y suelta hojas.
 * Ambos suben con el banner de cookies (--banner-cookies-alto) y respetan
 * safe-area-inset-bottom.
 */
export function FijosInferiores() {
  const pathname = usePathname()
  const enDonar = pathname.startsWith('/donar')
  const [arriba, setArriba] = useState(false)
  const botonRef = useRef<HTMLButtonElement>(null)
  const anilloRef = useRef<SVGCircleElement>(null)

  // Visible tras una pantalla de scroll + anillo de progreso (sin forzar layout).
  // biome-ignore lint/correctness/useExhaustiveDependencies: se rehace al cambiar de ruta.
  useEffect(() => {
    let pendiente = 0
    const revisar = () => {
      pendiente = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? window.scrollY / max : 0
      setArriba(window.scrollY > window.innerHeight * 0.9)
      anilloRef.current?.style.setProperty('stroke-dashoffset', String(1 - p))
    }
    const alDesplazar = () => {
      if (!pendiente) pendiente = window.requestAnimationFrame(revisar)
    }
    revisar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    window.addEventListener('resize', alDesplazar)
    return () => {
      window.removeEventListener('scroll', alDesplazar)
      window.removeEventListener('resize', alDesplazar)
      window.cancelAnimationFrame(pendiente)
    }
  }, [pathname])

  const subir = () => {
    const boton = botonRef.current
    const enfocarInicio = () => document.querySelector<HTMLElement>('[data-saltar]')?.focus({ preventScroll: true })
    if (!boton || prefiereMenosMovimiento()) {
      desplazarA(0, enfocarInicio)
      return
    }
    const { gsap } = registrarGsap()
    const caja = boton.getBoundingClientRect()
    lanzarSemillas(caja.left + caja.width / 2, caja.top + caja.height / 2, { cantidad: 9, fuerza: 320, tipo: 'hoja' })
    gsap
      .timeline()
      .to(boton.querySelector('[data-subir-flecha]'), { rotation: '-=360', duration: 0.9, ease: EASE.vuelta })
      .to(boton, { y: -26, scale: 1.12, duration: 0.35, ease: 'power2.out' }, 0)
      .to(boton, { y: 0, scale: 1, duration: 0.7, ease: EASE.salto }, 0.4)
    desplazarA(0, enfocarInicio)
  }

  return (
    <div data-fijo-inferior="" className="fijos" data-con-donar={enDonar ? 'no' : 'si'}>
      {enDonar ? null : (
        <Link href="/donar" data-seccion-tema="lima" className="barra-donar" data-cursor="Donar">
          <span className="barra-donar-texto">Donar ahora</span>
          <span className="barra-donar-sello" aria-hidden="true">
            <FlechaTrazo grosor={12} className="barra-donar-flecha" />
          </span>
        </Link>
      )}
      <button
        ref={botonRef}
        type="button"
        onClick={subir}
        aria-label="Volver arriba"
        data-seccion-tema="bosque"
        data-cursor="Arriba"
        className="ir-arriba"
        data-visible={arriba ? 'si' : 'no'}
        tabIndex={arriba ? 0 : -1}
        aria-hidden={arriba ? undefined : true}
      >
        <svg viewBox="0 0 64 64" className="ir-arriba-anillo" aria-hidden="true">
          <circle cx="32" cy="32" r="29" pathLength={1} className="ir-arriba-pista" />
          <circle ref={anilloRef} cx="32" cy="32" r="29" pathLength={1} className="ir-arriba-progreso" />
        </svg>
        <span data-subir-flecha="" className="ir-arriba-flecha">
          <FlechaTrazo grosor={11} className="size-full" />
        </span>
      </button>
    </div>
  )
}
