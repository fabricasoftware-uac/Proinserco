'use client'

import Image from 'next/image'
import Link from 'next/link'
import { type KeyboardEvent, type MouseEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { ENLACES_SECCION, type PreviaMenu } from './enlaces'
import { FlechaMarca, FlechaTrazo } from './flecha'
import { bloquearScroll, CONSULTA_PUNTERO_FINO, EASE, irAAncla, prefiereMenosMovimiento, registrarGsap } from './movimiento'

type Props = {
  abierto: boolean
  esInicio: boolean
  onCerrar: () => void
  botonRef: RefObject<HTMLButtonElement | null>
  previas: readonly PreviaMenu[]
  telefono: { texto: string; enlace: string }
  direccion: string
}

const ENFOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
const FONDO_PAGINA = '#contenido, footer[data-pie], [data-fijo-inferior]'
/** Desvío de cada capa respecto al centro del botón: el barrido es orgánico, no un círculo perfecto. */
const DESVIOS = [
  [-36, 18],
  [28, -14],
  [0, 0],
] as const
/** Sangría por enlace: el bloque se ve compuesto a mano, no auto-maquetado. */
const SANGRIAS = ['0em', '0.9em', '0.3em', '1.4em', '0.6em', '0.1em']

/**
 * E3 — "Círculos de color desde el aro". Tres capas (terracota, lima,
 * bosque) se abren en círculo desde el botón de menú; los enlaces gigantes
 * suben letra a letra; al pasar el ratón, una foto enmarcada sigue al
 * puntero y los demás enlaces se desenfocan; la flecha de la marca asoma
 * rodando por la esquina. Trampa de foco, Escape, `inert` en el resto y
 * scroll detenido. Movimiento reducido: fundido de 180 ms.
 */
export function MenuPantalla({ abierto, esInicio, onCerrar, botonRef, previas, telefono, direccion }: Props) {
  const [visible, setVisible] = useState(false)
  const [activa, setActiva] = useState<string | null>(null)
  const capaRef = useRef<HTMLDivElement>(null)
  const previaRef = useRef<HTMLDivElement>(null)
  const anclaPendiente = useRef<string | null>(null)
  const partido = useRef<{ revert: () => void } | null>(null)

  if (abierto && !visible) setVisible(true)

  // Coreografía de apertura y cierre.
  useEffect(() => {
    const capa = capaRef.current
    if (!capa || !visible) return
    const { gsap, SplitText } = registrarGsap()
    const reducido = prefiereMenosMovimiento()
    const capas = capa.querySelectorAll<HTMLElement>('[data-menu-capa]')
    const enlaces = capa.querySelectorAll<HTMLElement>('[data-menu-texto]')
    const resto = capa.querySelectorAll('[data-menu-resto]')
    const cerrar = capa.querySelector('[data-menu-cerrar]')
    const rueda = capa.querySelector('[data-menu-rueda]')
    const fondoPagina = document.querySelectorAll<HTMLElement>(FONDO_PAGINA)

    // Origen = centro del botón de menú (medido ahora: cambia con el ancho).
    const caja = botonRef.current?.getBoundingClientRect()
    const ox = caja ? caja.left + caja.width / 2 : window.innerWidth - 40
    const oy = caja ? caja.top + caja.height / 2 : 40
    const radio = Math.hypot(Math.max(ox, window.innerWidth - ox), Math.max(oy, window.innerHeight - oy)) + 60
    const circulo = (i: number, r: number) => {
      const [dx, dy] = DESVIOS[i] ?? [0, 0]
      return `circle(${r}px at ${ox + dx}px ${oy + dy}px)`
    }

    if (abierto) {
      bloquearScroll(true)
      for (const el of fondoPagina) el.inert = true
      const tl = gsap.timeline()
      if (reducido) {
        gsap.set(capas, { clipPath: 'none' })
        tl.fromTo(capa, { opacity: 0 }, { opacity: 1, duration: 0.18 })
      } else {
        if (!partido.current && enlaces.length) {
          partido.current = SplitText.create(enlaces, { type: 'chars', mask: 'chars', charsClass: 'menu-letra' })
        }
        const letras = capa.querySelectorAll('.menu-letra')
        tl.set(capa, { opacity: 1 })
        capas.forEach((c, i) => {
          tl.fromTo(c, { clipPath: circulo(i, 0) }, { clipPath: circulo(i, radio), duration: 0.9, ease: EASE.telon }, i * 0.12)
        })
        tl.fromTo(
          letras,
          { yPercent: 115, rotation: 8 },
          { yPercent: 0, rotation: 0, duration: 0.75, stagger: 0.018, ease: EASE.expoSalida },
          0.5,
        )
          .fromTo(resto, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: EASE.expoSalida }, 0.7)
          .fromTo(cerrar, { scale: 0.6, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.7, ease: EASE.salto }, 0.45)
          .fromTo(
            rueda,
            { rotation: -120, scale: 0.6, opacity: 0 },
            { rotation: 0, scale: 1, opacity: 1, duration: 1.2, ease: EASE.expoSalida },
            0.55,
          )
      }
      const primero = capa.querySelector<HTMLElement>('[data-menu-enlace]')
      primero?.focus({ preventScroll: true })
      return () => {
        tl.kill()
      }
    }

    // Cierre: contenido fuera rápido y las capas se recogen hacia el botón.
    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false)
        setActiva(null)
        for (const el of fondoPagina) el.inert = false
        bloquearScroll(false)
        const ancla = anclaPendiente.current
        anclaPendiente.current = null
        if (ancla) irAAncla(ancla)
        else botonRef.current?.focus({ preventScroll: true })
      },
    })
    if (reducido) tl.to(capa, { opacity: 0, duration: 0.15 })
    else {
      tl.to([enlaces, resto, cerrar, rueda], { opacity: 0, y: -14, duration: 0.22, ease: EASE.entrada })
      ;[...capas].reverse().forEach((c, j) => {
        const i = capas.length - 1 - j
        tl.to(c, { clipPath: circulo(i, 0), duration: 0.6, ease: EASE.telon }, 0.12 + j * 0.08)
      })
      tl.add(() => gsap.set([enlaces, resto, cerrar, rueda], { clearProps: 'opacity,transform' }))
    }
    return () => {
      tl.kill()
    }
  }, [abierto, visible, botonRef])

  // Previa que sigue al puntero (solo puntero fino y con movimiento).
  useEffect(() => {
    const capa = capaRef.current
    const previa = previaRef.current
    if (!capa || !previa || !visible) return
    if (!window.matchMedia(CONSULTA_PUNTERO_FINO).matches || prefiereMenosMovimiento()) return
    const { gsap } = registrarGsap()
    const ax = gsap.quickTo(previa, 'x', { duration: 0.7, ease: 'power3.out' })
    const ay = gsap.quickTo(previa, 'y', { duration: 0.7, ease: 'power3.out' })
    const ar = gsap.quickTo(previa, 'rotation', { duration: 0.9, ease: 'power3.out' })
    // La previa vive en su sitio (mitad derecha, centrada) y solo deriva un poco con el puntero.
    let ultimoX = 0
    const mover = (e: PointerEvent) => {
      const v = e.clientX - ultimoX
      ultimoX = e.clientX
      ax((e.clientX / window.innerWidth - 0.5) * 50)
      ay((e.clientY / window.innerHeight - 0.5) * 36)
      ar(gsap.utils.clamp(-6, 6, v * 0.25) - 2)
    }
    capa.addEventListener('pointermove', mover)
    return () => capa.removeEventListener('pointermove', mover)
  }, [visible])

  // Al cambiar de enlace activo: la previa rebota.
  useEffect(() => {
    const previa = previaRef.current
    if (!previa || !activa || prefiereMenosMovimiento()) return
    const { gsap } = registrarGsap()
    const t = gsap.fromTo(previa.firstElementChild, { scale: 0.82 }, { scale: 1, duration: 0.6, ease: EASE.salto })
    return () => {
      t.kill()
    }
  }, [activa])

  useEffect(
    () => () => {
      partido.current?.revert()
      bloquearScroll(false)
      for (const el of document.querySelectorAll<HTMLElement>(FONDO_PAGINA)) el.inert = false
    },
    [],
  )

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCerrar()
      return
    }
    if (e.key !== 'Tab' || !capaRef.current) return
    const focos = [...capaRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
    const primero = focos[0]
    const ultimo = focos[focos.length - 1]
    if (!primero || !ultimo) return
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  const alPulsarSeccion = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!esInicio) return
    e.preventDefault()
    anclaPendiente.current = id
    onCerrar()
  }

  return (
    <div
      ref={capaRef}
      id="menu-principal"
      role="dialog"
      aria-modal="true"
      aria-label="Menú principal"
      hidden={!visible}
      onKeyDown={alTeclear}
      data-seccion-tema="bosque"
      className="menu"
    >
      <div data-menu-capa="" className="menu-capa bg-pintura-terracota" />
      <div data-menu-capa="" className="menu-capa bg-pintura-lima" />
      <div data-menu-capa="" className="menu-capa bg-superficie">
        <FlechaMarca data-menu-rueda="" className="menu-rueda" />
      </div>

      <div className="menu-contenido">
        <div className="menu-cabecera">
          <p data-menu-resto="" className="menu-marca">
            Proinserco
          </p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar menú"
            data-menu-cerrar=""
            data-cursor="Cerrar"
            className="menu-cerrar"
          >
            <FlechaTrazo grosor={5} className="boton-menu-aro" />
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Principal" className="menu-nav">
          <ul className="menu-lista">
            {ENLACES_SECCION.map((e, i) => (
              <li key={e.id} className="menu-item">
                <Link
                  href={`/#${e.id}`}
                  data-menu-enlace=""
                  onClick={(ev) => alPulsarSeccion(ev, e.id)}
                  onPointerEnter={() => setActiva(e.id)}
                  onPointerLeave={() => setActiva((a) => (a === e.id ? null : a))}
                  className="menu-enlace"
                  style={{ paddingLeft: SANGRIAS[i] }}
                >
                  <span data-menu-texto="">{e.etiqueta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="menu-pie">
          <address data-menu-resto="" className="menu-contacto">
            <a
              href={telefono.enlace}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir por WhatsApp al ${telefono.texto}`}
              className="menu-telefono"
              data-cursor="WhatsApp"
            >
              {telefono.texto}
            </a>
            <span className="menu-direccion">{direccion}</span>
          </address>
          <Link
            href="/donar"
            data-menu-resto=""
            onClick={() => onCerrar()}
            data-seccion-tema="lima"
            data-cursor="Donar"
            className="menu-donar"
          >
            <span>Donar ahora</span>
            <FlechaTrazo grosor={12} className="menu-donar-flecha" />
          </Link>
        </div>
      </div>

      <div ref={previaRef} aria-hidden="true" className="menu-previa" data-activa={activa ? 'si' : 'no'}>
        <div className="menu-previa-marco">
          {previas.map((p) => (
            <Image
              key={p.id}
              src={p.src}
              alt=""
              fill
              sizes="(min-width: 1024px) 26rem, 1px"
              className="menu-previa-foto"
              data-visible={activa === p.id ? 'si' : 'no'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
