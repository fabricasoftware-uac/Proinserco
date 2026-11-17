'use client'

import { useEffect, useRef } from 'react'
import { ARO_D, PUNTA_D } from './flecha'
import { EASE, EVENTO_SALIDA_INTRO, prefiereMenosMovimiento, registrarGsap } from './movimiento'

const SEGURIDAD_MS = 8000

/** Frases del camino: cambian por tramos del contador. */
const FRASES = ['Subiendo a la vereda…', 'Poniendo el tinto…', 'Saludando a la junta…', '¡Aquí estamos!'] as const

/**
 * E1 — "La flecha que cierra el círculo" (símbolo modernizado).
 * Una chispa lima recorre el aro de la flecha dibujándolo y soltando
 * semillas; el contador sube con frases del territorio; al 100 brota la
 * barra de la P y el símbolo da la vuelta. La salida es una cortina que sube
 * (clip-path, sin tirones) y la portada entra cuando la cortina EMPIEZA.
 *
 * Solo existe si /sitio/intro.js marcó <html data-intro='si'> (primera visita
 * de la sesión). Movimiento reducido: símbolo quieto con fundido de 300 ms.
 * Salida garantizada: botón "Saltar", temporizador de 8 s, red de intro.js.
 */
export function Loader() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raiz = document.documentElement
    const capa = ref.current
    if (!capa || raiz.dataset.intro !== 'si') return
    const { gsap } = registrarGsap()
    capa.setAttribute('data-activa', '')

    let terminado = false
    let salidaAnunciada = false
    const anunciarSalida = () => {
      if (salidaAnunciada) return
      salidaAnunciada = true
      window.dispatchEvent(new Event(EVENTO_SALIDA_INTRO))
    }
    const terminar = () => {
      if (terminado) return
      terminado = true
      anunciarSalida()
      raiz.dataset.intro = 'no'
      capa.removeAttribute('data-activa')
      gsap.set(capa, { clearProps: 'clipPath,opacity' })
    }
    const seguridad = window.setTimeout(terminar, SEGURIDAD_MS)
    const q = <T extends Element = HTMLElement>(sel: string) => capa.querySelector<T>(sel)
    const saltar = q<HTMLButtonElement>('[data-loader-saltar]')

    if (prefiereMenosMovimiento()) {
      capa.dataset.modo = 'reducido'
      const t = window.setTimeout(() => gsap.to(capa, { opacity: 0, duration: 0.3, onComplete: terminar }), 500)
      return () => {
        window.clearTimeout(t)
        window.clearTimeout(seguridad)
        capa.removeAttribute('data-activa')
      }
    }

    const aro = q<SVGPathElement>('[data-loader-aro]')
    const punta = q('[data-loader-punta]')
    const palo = q('[data-loader-palo]')
    const flecha = q('[data-loader-flecha]')
    const chispa = q('[data-loader-chispa]')
    const contador = q('[data-loader-contador]')
    const frases = capa.querySelectorAll<HTMLElement>('[data-loader-frase]')
    const semillas = q('[data-loader-semillas]')
    const lienzo = q('[data-loader-lienzo]')
    if (!aro || !flecha || !lienzo) {
      terminar()
      return
    }
    const largo = aro.getTotalLength()
    const estado = { p: 0 }
    let fraseActual = -1
    let ultimaSemilla = 0

    const ponerFrase = (i: number) => {
      if (i === fraseActual) return
      const anterior = frases[fraseActual]
      const nueva = frases[i]
      fraseActual = i
      if (anterior) gsap.to(anterior, { yPercent: -100, opacity: 0, duration: 0.25, ease: EASE.entrada, overwrite: true })
      if (nueva)
        gsap.fromTo(
          nueva,
          { yPercent: 100, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.5, delay: 0.1, ease: EASE.expoSalida, overwrite: true },
        )
    }
    const soltarSemilla = (x: number, y: number) => {
      if (!semillas) return
      const s = document.createElement('span')
      s.className = 'loader-semilla'
      semillas.appendChild(s)
      gsap.set(s, { x, y, rotation: gsap.utils.random(0, 360) })
      gsap.to(s, {
        y: y + gsap.utils.random(50, 110),
        x: x + gsap.utils.random(-26, 26),
        rotation: `+=${gsap.utils.random(-200, 200)}`,
        opacity: 0,
        duration: gsap.utils.random(0.8, 1.3),
        ease: 'power1.in',
        onComplete: () => s.remove(),
      })
    }
    const pintar = () => {
      const p = estado.p
      if (contador) contador.textContent = String(Math.round(p * 100)).padStart(3, '0')
      ponerFrase(p < 0.34 ? 0 : p < 0.67 ? 1 : p < 0.98 ? 2 : 3)
      const punto = aro.getPointAtLength(largo * p)
      if (chispa) gsap.set(chispa, { attr: { cx: punto.x, cy: punto.y } })
      const ahora = performance.now()
      if (p > 0.02 && p < 0.99 && ahora - ultimaSemilla > 90) {
        ultimaSemilla = ahora
        const caja = lienzo.getBoundingClientRect()
        const cajaCapa = capa.getBoundingClientRect()
        soltarSemilla(
          caja.left - cajaCapa.left + (punto.x / 100) * caja.width,
          caja.top - cajaCapa.top + (punto.y / 100) * caja.height,
        )
      }
    }

    const tl = gsap.timeline({ defaults: { ease: EASE.salida } })
    tl.set(aro, { drawSVG: '0%' })
      .set(punta, { opacity: 0 })
      .set(palo, { scaleY: 0, transformOrigin: '50% 100%' })
      .fromTo('[data-loader-pie]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0.05)
      .fromTo(chispa, { opacity: 0, scale: 0, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3 }, 0.15)
      .to(estado, { p: 1, duration: 2.4, ease: 'power1.inOut', onUpdate: pintar }, 0.2)
      .to(aro, { drawSVG: '100%', duration: 2.4, ease: 'power1.inOut' }, 0.2)
      .to(punta, { opacity: 1, duration: 0.2 }, 2.55)
      .fromTo(punta, { scale: 0.3, transformOrigin: '20% 35%' }, { scale: 1, duration: 0.45, ease: EASE.salto }, 2.55)
      .to(chispa, { scale: 3, opacity: 0, duration: 0.4 }, 2.6)
      .to(palo, { scaleY: 1, duration: 0.6, ease: 'expo.out' }, 2.65)
      .to(flecha, { rotation: 360, svgOrigin: '50 50', duration: 1, ease: 'power3.inOut' }, 2.75)
      .addLabel('salida', 3.55)
      .add(anunciarSalida, 'salida')
      .to('[data-loader-pie]', { opacity: 0, duration: 0.35 }, 'salida')
      .to('[data-loader-simbolo]', { yPercent: -14, opacity: 0, duration: 0.8, ease: 'power2.in' }, 'salida')
      .fromTo(
        capa,
        { clipPath: 'inset(0% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: EASE.telon },
        'salida+=0.15',
      )
    tl.eventCallback('onComplete', () => {
      window.clearTimeout(seguridad)
      terminar()
    })

    const alSaltar = () => {
      window.clearTimeout(seguridad)
      tl.kill()
      anunciarSalida()
      gsap.to(capa, { opacity: 0, duration: 0.35, ease: EASE.salida, onComplete: terminar })
    }
    saltar?.addEventListener('click', alSaltar)

    // Sin terminar() en la limpieza: el modo estricto monta dos veces y la
    // segunda ejecución debe repetir la intro. intro.js retira la marca a los 9 s.
    return () => {
      saltar?.removeEventListener('click', alSaltar)
      window.clearTimeout(seguridad)
      tl.kill()
      gsap.set(capa, { clearProps: 'clipPath,opacity' })
      capa.removeAttribute('data-activa')
      if (semillas) semillas.textContent = ''
    }
  }, [])

  return (
    <div ref={ref} data-loader="" className="cargador" data-seccion-tema="bosque">
      <div data-loader-semillas="" aria-hidden="true" className="loader-semillas" />
      <div data-loader-simbolo="" aria-hidden="true" className="loader-logo">
        <svg data-loader-lienzo="" viewBox="0 0 100 100" aria-hidden="true" className="loader-lienzo" fill="none">
          <g data-loader-flecha="">
            <path d={ARO_D} stroke="currentColor" strokeWidth="1" opacity="0.14" strokeLinecap="round" />
            <path data-loader-aro="" d={ARO_D} className="loader-aro" strokeWidth="10" strokeLinecap="round" />
            <path data-loader-punta="" d={PUNTA_D} className="loader-punta" strokeWidth="3.5" strokeLinejoin="round" />
          </g>
          <rect data-loader-palo="" x="7" y="45" width="19" height="56" rx="6" className="loader-palo" />
          <circle data-loader-chispa="" cx="18" cy="62" r="2.6" className="loader-chispa" />
        </svg>
      </div>

      <div data-loader-pie="" className="loader-pie">
        <div className="loader-frases" aria-live="polite">
          {FRASES.map((f) => (
            <p key={f} data-loader-frase="" className="loader-frase">
              {f}
            </p>
          ))}
        </div>
        <p aria-hidden="true" data-loader-contador="" className="loader-contador">
          000
        </p>
      </div>

      <button type="button" data-loader-saltar="" className="loader-saltar">
        Saltar intro
      </button>
    </div>
  )
}
