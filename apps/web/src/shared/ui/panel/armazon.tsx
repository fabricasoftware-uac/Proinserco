'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Aro } from './aro'
import { Icono, type NombreIcono } from './iconos'
import { MenuUsuario } from './menu-usuario'
import { Paleta, type PaletaControl } from './paleta'

export type ItemNavegacion = Readonly<{ href: string; etiqueta: string; icono: NombreIcono; exacto?: boolean }>

type Props = {
  items: readonly ItemNavegacion[]
  usuario: Readonly<{ nombre: string; correo: string; rol: string }>
  /** Solo interfaz: oculta controles. El servidor valida cada permiso por su cuenta. */
  puedeBuscar: boolean
  puedeAjustes: boolean
  cerrarSesion: () => Promise<void>
  children: ReactNode
}

const CLAVE_COLAPSADA = 'panel-barra-colapsada'
const MOVIL = '(max-width: 899px)'

/** Armazón del panel: barra lateral de vidrio con indicador que se desliza, cabecera con paleta y menú de usuario. */
export function ArmazonPanel({ items, usuario, puedeBuscar, puedeAjustes, cerrarSesion, children }: Props) {
  const ruta = usePathname()
  const [colapsada, setColapsada] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const [esMovil, setEsMovil] = useState(false)
  const botonMenu = useRef<HTMLButtonElement>(null)
  const barra = useRef<HTMLElement>(null)
  const paleta = useRef<PaletaControl>(null)

  useEffect(() => {
    try {
      setColapsada(localStorage.getItem(CLAVE_COLAPSADA) === '1')
    } catch {
      // Sin almacenamiento: la barra arranca expandida.
    }
    const consulta = matchMedia(MOVIL)
    const alCambiar = () => setEsMovil(consulta.matches)
    alCambiar()
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  // Cada navegación cierra la hoja del móvil.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ruta` es el disparador
  useEffect(() => {
    setAbierta(false)
  }, [ruta])

  const cerrarHoja = useCallback(() => {
    setAbierta(false)
    botonMenu.current?.focus()
  }, [])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierta) cerrarHoja()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        paleta.current?.abrir()
      }
    }
    document.addEventListener('keydown', teclas)
    return () => document.removeEventListener('keydown', teclas)
  }, [abierta, cerrarHoja])

  useEffect(() => {
    if (abierta) barra.current?.querySelector<HTMLElement>('.pn-nav a')?.focus()
  }, [abierta])

  function alternarColapso() {
    const nueva = !colapsada
    setColapsada(nueva)
    try {
      localStorage.setItem(CLAVE_COLAPSADA, nueva ? '1' : '0')
    } catch {
      // Sin persistencia: solo dura la visita.
    }
  }

  const barraOculta = esMovil && !abierta
  const barraPlegada = colapsada && !esMovil
  const indiceActivo = items.findIndex((item) =>
    item.exacto ? ruta === item.href : ruta === item.href || ruta.startsWith(`${item.href}/`),
  )

  return (
    <div className="pn-app" data-colapsada={barraPlegada ? '' : undefined} data-abierta={abierta ? '' : undefined}>
      <a className="pn-saltar" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="pn-lateral" ref={barra} aria-label="Barra lateral" inert={barraOculta}>
        <Link href="/panel" className="pn-marca" aria-label="Fundación Proinserco, ir al resumen">
          {/* biome-ignore lint/performance/noImgElement: logo vectorial estatico, no necesita optimizacion */}
          <img src="/marca/proinserco-simbolo.svg" alt="" width={34} height={34} />
          <span className="pn-oculto-colapsada pn-marca-texto">
            Proinserco
            <small>Panel de la fundación</small>
          </span>
        </Link>

        <nav aria-label="Secciones del panel" className="pn-nav-zona">
          <ul className="pn-nav" style={{ '--pn-activo': Math.max(indiceActivo, 0) } as CSSProperties}>
            {indiceActivo >= 0 ? (
              <li className="pn-nav-indicador" aria-hidden="true">
                <span className="pn-nav-flecha">
                  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                    <path
                      d="M3.2 2.6a4.6 4.6 0 1 1-1 5.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M1.1 5.3l1.2 3 2.9-1.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </li>
            ) : null}
            {items.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={i === indiceActivo ? 'page' : undefined}
                  title={barraPlegada ? item.etiqueta : undefined}
                >
                  <Icono nombre={item.icono} />
                  <span className="pn-etiqueta-nav">{item.etiqueta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="pn-lateral-pie">
          <p className="pn-sesion">
            <span className="pn-sesion-aro">
              <Aro forma="cerrado" tono="ok" tamano={20} />
            </span>
            <span className={barraPlegada ? 'pn-solo-lectores' : 'pn-sesion-texto'}>
              Sesión protegida
              <small>Contraseña y código verificados</small>
            </span>
          </p>
          <button
            type="button"
            className="pn-colapsar pn-solo-escritorio"
            onClick={alternarColapso}
            aria-pressed={colapsada}
            aria-label={colapsada ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            <Icono nombre={colapsada ? 'chevron-der' : 'chevron-izq'} tamano={18} />
          </button>
        </div>
      </aside>
      <div className="pn-velo" onClick={cerrarHoja} aria-hidden="true" />

      <div className="pn-principal" inert={abierta && esMovil}>
        <header className="pn-cabecera">
          <button
            ref={botonMenu}
            type="button"
            className="pn-boton pn-boton--suave pn-boton--icono pn-solo-movil"
            aria-label="Abrir menú de navegación"
            aria-expanded={abierta}
            onClick={() => setAbierta(true)}
          >
            <Icono nombre="menu" />
          </button>
          <Link href="/panel" className="pn-marca-movil pn-solo-movil" aria-label="Ir al resumen">
            {/* biome-ignore lint/performance/noImgElement: logo vectorial estatico */}
            <img src="/marca/proinserco-simbolo.svg" alt="" width={26} height={26} />
          </Link>

          <button type="button" className="pn-busqueda" onClick={() => paleta.current?.abrir()} aria-haspopup="dialog">
            <Icono nombre="buscar" tamano={17} />
            <span className="pn-busqueda-texto">{puedeBuscar ? 'Buscar donaciones o ir a…' : 'Ir a…'}</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="pn-cabecera-acciones">
            <MenuUsuario
              nombre={usuario.nombre}
              correo={usuario.correo}
              rol={usuario.rol}
              puedeAjustes={puedeAjustes}
              cerrarSesion={cerrarSesion}
            />
          </div>
        </header>

        <main id="contenido" tabIndex={-1} className="pn-contenido">
          {children}
        </main>
      </div>

      <Paleta ref={paleta} destinos={items} puedeBuscar={puedeBuscar} />
    </div>
  )
}
