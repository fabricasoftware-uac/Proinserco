'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { SelectorTema } from '../tema/selector-tema'
import { Aro } from './aro'
import { iniciales } from './formato'
import { Icono } from './iconos'

type Props = {
  nombre: string
  correo: string
  rol: string
  puedeAjustes: boolean
  cerrarSesion: () => Promise<void>
}

/** Menú de usuario: perfil, segundo factor, tema y cierre de sesión. */
export function MenuUsuario({ nombre, correo, rol, puedeAjustes, cerrarSesion }: Props) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const idMenu = useId()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false)
    }
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', teclas)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', teclas)
    }
  }, [abierto])

  return (
    <div className="pn-usuario" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className="pn-usuario-boton"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        aria-haspopup="true"
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="pn-avatar" aria-hidden="true">
          {iniciales(nombre)}
        </span>
        <span className="pn-usuario-nombre" aria-hidden="true">
          {nombre.split(' ')[0]}
        </span>
        <span className="pn-solo-lectores">Menú de usuario: {nombre}</span>
        <Icono nombre="chevron-abajo" tamano={14} />
      </button>
      {abierto ? (
        <div className="pn-menu" id={idMenu}>
          <div className="pn-menu-cab">
            <span className="pn-avatar pn-avatar--grande" aria-hidden="true">
              {iniciales(nombre)}
            </span>
            <span className="pn-menu-quien">
              <strong>{nombre}</strong>
              <span>{correo}</span>
            </span>
          </div>
          <ul className="pn-menu-hechos">
            <li>
              <Aro forma="cerrado" tono="ok" tamano={16} />
              Segundo factor activo
            </li>
            <li>
              <Aro forma="punto" tono="info" tamano={16} />
              Rol: {rol}
            </li>
          </ul>
          <div className="pn-menu-tema">
            <span className="pn-menu-rotulo" aria-hidden="true">
              Apariencia
            </span>
            <SelectorTema />
          </div>
          <div className="pn-menu-acciones">
            {puedeAjustes ? (
              <Link className="pn-menu-enlace" href="/panel/ajustes" onClick={() => setAbierto(false)}>
                <Icono nombre="ajustes" tamano={18} />
                Ajustes y seguridad
              </Link>
            ) : null}
            <form action={cerrarSesion}>
              <button type="submit" className="pn-menu-enlace pn-menu-enlace--salir">
                <Icono nombre="salir" tamano={18} />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
