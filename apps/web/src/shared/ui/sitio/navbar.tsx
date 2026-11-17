'use client'

import type { TemaSeccion } from '@proinserco/tokens'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ENLACES_SECCION, type PreviaMenu } from './enlaces'
import { FlechaTrazo } from './flecha'
import { MenuPantalla } from './menu-pantalla'
import { desplazarA, irAAncla, registrarGsap } from './movimiento'

type Props = {
  previas: readonly PreviaMenu[]
  telefono: { texto: string; enlace: string }
  direccion: string
}

const TEMAS: readonly string[] = ['crema', 'bosque', 'terracota', 'sol', 'lima', 'cielo']
const IDS_ENLACE: readonly string[] = ENLACES_SECCION.map((e) => e.id)

/**
 * Navbar tradicional: logo a la izquierda, enlaces de sección visibles,
 * "Donar" y menú a la derecha. Toma el color del plano que tiene DEBAJO
 * (lectura con elementsFromPoint en cada scroll: vale para secciones
 * sticky, persianas, recargas a mitad de página, anclas y resize) y marca
 * la sección actual con un indicador que se desliza entre enlaces. Al
 * llegar al footer se acopla y el footer despliega su marco.
 */
export function Navbar({ previas, telefono, direccion }: Props) {
  const pathname = usePathname()
  const esInicio = pathname === '/'
  const enDonar = pathname.startsWith('/donar')
  const [tema, setTema] = useState<TemaSeccion>('bosque')
  const [activo, setActivo] = useState<string | null>(null)
  const [fusion, setFusion] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [conFondo, setConFondo] = useState(false)
  const cabeceraRef = useRef<HTMLElement>(null)
  const botonMenuRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const indicadorRef = useRef<HTMLSpanElement>(null)

  // ── Lectura del plano de debajo y de la sección activa ─────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: se rehace al cambiar de ruta.
  useEffect(() => {
    const cabecera = cabeceraRef.current
    if (!cabecera) return
    let marco = 0
    const tardios: number[] = []

    const leer = () => {
      marco = 0
      const y = Math.round(cabecera.offsetTop + cabecera.offsetHeight / 2)
      let nuevo: string | null = null
      for (const x of [window.innerWidth * 0.5, window.innerWidth * 0.08]) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (cabecera.contains(el) || el.closest('[data-fuera-nav]')) continue
          const plano = el.closest<HTMLElement>('[data-nav]')
          if (!plano) continue
          nuevo = plano.dataset.nav ?? null
          break
        }
        if (nuevo) break
      }
      setTema((TEMAS.includes(nuevo ?? '') ? nuevo : 'crema') as TemaSeccion)
      setConFondo(window.scrollY > 8)
      // Sección activa: el último enlace cuya sección ya pasó bajo el navbar.
      let id: string | null = null
      const linea = y + 40
      for (const ide of IDS_ENLACE) {
        const s = document.getElementById(ide)
        if (s && s.getBoundingClientRect().top <= linea) id = ide
      }
      setActivo(id)
    }
    const pedir = () => {
      if (!marco) marco = window.requestAnimationFrame(leer)
    }
    const alDesplazar = () => {
      pedir()
      // Lecturas tardías: los scrub y Lenis siguen moviendo cosas tras el último evento.
      for (const t of tardios.splice(0)) window.clearTimeout(t)
      for (const ms of [180, 450, 900]) tardios.push(window.setTimeout(pedir, ms))
    }
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    window.addEventListener('resize', alDesplazar)
    window.addEventListener('load', alDesplazar)
    window.addEventListener('proinserco:releer-nav', alDesplazar)
    return () => {
      window.removeEventListener('scroll', alDesplazar)
      window.removeEventListener('resize', alDesplazar)
      window.removeEventListener('load', alDesplazar)
      window.removeEventListener('proinserco:releer-nav', alDesplazar)
      window.cancelAnimationFrame(marco)
      for (const t of tardios) window.clearTimeout(t)
    }
  }, [pathname])

  // ── Indicador que se desliza al enlace activo (solo transform) ─────
  useLayoutEffect(() => {
    const lista = listaRef.current
    const ind = indicadorRef.current
    if (!lista || !ind) return
    const colocar = () => {
      const a = activo && esInicio ? lista.querySelector<HTMLElement>(`[data-enlace="${activo}"]`) : null
      if (!a) {
        ind.dataset.visible = 'no'
        return
      }
      ind.dataset.visible = 'si'
      ind.style.transform = `translateX(${a.offsetLeft}px) scaleX(${a.offsetWidth / 100})`
    }
    colocar()
    window.addEventListener('resize', colocar)
    document.fonts?.ready.then(colocar)
    return () => window.removeEventListener('resize', colocar)
  }, [activo, esInicio])

  // ── Fusión con el footer ────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: se rehace al cambiar de ruta.
  useEffect(() => {
    const pie = document.querySelector<HTMLElement>('footer[data-pie]')
    if (!pie) return
    const { ScrollTrigger } = registrarGsap()
    const st = ScrollTrigger.create({
      trigger: pie,
      start: 'top 12%',
      // 'bottom top' nunca se alcanza (el footer es lo último): activo hasta el final. Con 'max' se apagaba justo al llegar.
      end: 'bottom top',
      refreshPriority: -1,
      onToggle: (self) => {
        setFusion(self.isActive)
        pie.dataset.fusion = self.isActive ? 'si' : 'no'
      },
    })
    return () => {
      st.kill()
      pie.dataset.fusion = 'no'
    }
  }, [pathname])

  // biome-ignore lint/correctness/useExhaustiveDependencies: depende solo de la ruta.
  useEffect(() => {
    setMenuAbierto(false)
  }, [pathname])

  const alPulsarLogo = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!esInicio) return
    e.preventDefault()
    desplazarA(0)
  }
  const alPulsarSeccion = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!esInicio) return
    e.preventDefault()
    irAAncla(id)
  }

  const temaFinal: TemaSeccion = fusion ? 'bosque' : tema
  const temaDonar: TemaSeccion = temaFinal === 'lima' ? 'bosque' : 'lima'

  return (
    <>
      <header
        ref={cabeceraRef}
        data-navbar=""
        data-seccion-tema={temaFinal}
        data-fusion={fusion ? 'si' : 'no'}
        data-fondo={conFondo ? 'si' : 'no'}
        inert={menuAbierto}
        className="navbar"
      >
        <div className="navbar-interior">
          <Link href="/" onClick={alPulsarLogo} className="navbar-logo" aria-label="Fundación Proinserco, inicio">
            <Image
              src="/marca/proinserco-simbolo.svg"
              alt=""
              width={36}
              height={36}
              unoptimized
              className="navbar-logo-simbolo"
            />
            <span className="navbar-logo-nombre">Proinserco</span>
          </Link>

          <nav aria-label="Secciones" className="navbar-nav">
            <span ref={indicadorRef} aria-hidden="true" className="navbar-indicador" data-visible="no" />
            <ul ref={listaRef} className="navbar-lista">
              {ENLACES_SECCION.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/#${e.id}`}
                    data-enlace={e.id}
                    onClick={(ev) => alPulsarSeccion(ev, e.id)}
                    aria-current={esInicio && activo === e.id ? 'location' : undefined}
                    className="navbar-enlace"
                  >
                    {e.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="navbar-acciones">
            {enDonar ? null : (
              <Link href="/donar" data-seccion-tema={temaDonar} className="navbar-donar">
                Donar
                <FlechaTrazo grosor={12} className="navbar-donar-flecha" />
              </Link>
            )}
            <button
              ref={botonMenuRef}
              type="button"
              aria-expanded={menuAbierto}
              aria-controls="menu-principal"
              aria-label="Abrir menú"
              data-cursor="Menú"
              onClick={() => setMenuAbierto(true)}
              className="boton-menu"
            >
              <span className="boton-menu-lineas" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      <MenuPantalla
        abierto={menuAbierto}
        esInicio={esInicio}
        onCerrar={() => setMenuAbierto(false)}
        botonRef={botonMenuRef}
        previas={previas}
        telefono={telefono}
        direccion={direccion}
      />
    </>
  )
}
