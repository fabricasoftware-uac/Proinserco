import Link from 'next/link'
import type { ReactNode } from 'react'
import { type Escena, Estado, Ilustracion, type Tono } from './aro'
import { Icono } from './iconos'

export type { Tono } from './aro'

/** Estado genérico (aro + texto). Mantiene el nombre histórico para las páginas. */
export function Insignia({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <Estado tono={tono}>{children}</Estado>
}

type Volver = Readonly<{ etiqueta: string; href: string }>

export function EncabezadoPagina({
  titulo,
  descripcion,
  volver,
  acciones,
  aparte,
}: {
  titulo: ReactNode
  descripcion?: ReactNode
  /** Enlace de regreso (sustituye a las migas: una sola jerarquía). */
  volver?: Volver
  acciones?: ReactNode
  /** Pieza a la derecha del título (fecha, cifra...). */
  aparte?: ReactNode
}) {
  return (
    <header className="pn-encabezado">
      <div className="pn-encabezado-texto">
        {volver ? (
          <Link className="pn-volver" href={volver.href}>
            <Icono nombre="flecha-izq" tamano={16} />
            {volver.etiqueta}
          </Link>
        ) : null}
        <h1 className="pn-titulo">{titulo}</h1>
        {descripcion ? <p className="pn-subtitulo">{descripcion}</p> : null}
      </div>
      {aparte ? <div className="pn-encabezado-aparte">{aparte}</div> : null}
      {acciones ? <div className="pn-encabezado-acciones">{acciones}</div> : null}
    </header>
  )
}

export function Tarjeta({
  titulo,
  nota,
  acciones,
  sinRelleno,
  children,
  id,
  plana,
  className,
}: {
  titulo?: string | undefined
  nota?: ReactNode
  acciones?: ReactNode
  sinRelleno?: boolean | undefined
  children: ReactNode
  id?: string | undefined
  /** Sin material: el contenido se apoya directo en el papel. */
  plana?: boolean
  className?: string
}) {
  const idTitulo = id ? `${id}-titulo` : undefined
  const clases = ['pn-tarjeta', sinRelleno ? 'pn-tarjeta--sin-relleno' : '', plana ? 'pn-tarjeta--plana' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <section className={clases} aria-labelledby={titulo ? idTitulo : undefined}>
      {titulo ? (
        <div className="pn-tarjeta-cab">
          <div>
            <h2 id={idTitulo}>{titulo}</h2>
            {nota ? <p className="pn-tarjeta-nota">{nota}</p> : null}
          </div>
          {acciones ? <div className="pn-tarjeta-acciones">{acciones}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

type PropsEstado = {
  titulo: string
  descripcion: ReactNode
  escena?: Escena
  accion?: ReactNode
  tono?: 'malo' | 'aviso'
  /** Código para soporte (digest del error). Nunca trazas. */
  codigo?: string | undefined
  /** Encabezado de página (h1) en vez de sección (h2). */
  principal?: boolean
}

/** Vacío, error o "sin permiso": ilustración propia y voz cercana. */
export function EstadoPanel({ titulo, descripcion, escena = 'vacio', accion, tono, codigo, principal }: PropsEstado) {
  const Titulo = principal ? 'h1' : 'h2'
  return (
    <div className={tono ? `pn-estado pn-estado--${tono}` : 'pn-estado'} role={tono === 'malo' ? 'alert' : undefined}>
      <Ilustracion escena={escena} />
      <Titulo>{titulo}</Titulo>
      <p>{descripcion}</p>
      {codigo ? (
        <p className="pn-estado-codigo">
          Código para soporte <span className="pn-codigo-soporte">{codigo}</span>
        </p>
      ) : null}
      {accion ? <div className="pn-estado-accion">{accion}</div> : null}
    </div>
  )
}

export function Esqueleto({
  ancho = '100%',
  alto = '1rem',
  radio,
  className,
}: {
  ancho?: string
  alto?: string
  radio?: string
  className?: string
}) {
  return (
    <span
      className={className ? `pn-esqueleto ${className}` : 'pn-esqueleto'}
      aria-hidden="true"
      style={{ width: ancho, height: alto, ...(radio ? { borderRadius: radio } : {}) }}
    />
  )
}

/** Contenedor de carga accesible: anuncia una vez y oculta las formas. */
export function Cargando({ children, etiqueta = 'Cargando' }: { children: ReactNode; etiqueta?: string }) {
  return (
    <output className="pn-cargando" aria-live="polite" aria-busy="true">
      <span className="pn-solo-lectores">{etiqueta}</span>
      {children}
    </output>
  )
}

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
const ALTURAS = ['38%', '22%', '64%', '30%', '88%', '18%', '46%', '72%', '26%', '54%', '34%', '60%', '20%', '42%'] as const

function EncabezadoEsqueleto({ conVolver = false }: { conVolver?: boolean }) {
  return (
    <div className="pn-encabezado">
      <div className="pn-encabezado-texto pn-esq-pila">
        {conVolver ? <Esqueleto ancho="6rem" alto="0.875rem" /> : null}
        <Esqueleto ancho="13rem" alto="2.5rem" radio="0.75rem" />
        <Esqueleto ancho="min(24rem, 80%)" alto="0.95rem" />
      </div>
    </div>
  )
}

/** Carga del resumen: la forma real (cifra protagonista, franja, gráfica de barras, línea de tiempo). */
export function EsqueletoResumen() {
  return (
    <Cargando etiqueta="Cargando el resumen">
      <EncabezadoEsqueleto />
      <div className="pn-heroe pn-heroe--esqueleto">
        <div className="pn-esq-pila">
          <Esqueleto ancho="9rem" alto="0.95rem" />
          <Esqueleto ancho="min(22rem, 90%)" alto="4.25rem" radio="1rem" />
          <Esqueleto ancho="12rem" alto="0.95rem" />
        </div>
        <Esqueleto ancho="9.5rem" alto="9.5rem" radio="50%" className="pn-esq-aro" />
      </div>
      <div className="pn-franja">
        {IDS.slice(0, 3).map((id) => (
          <div key={id} className="pn-franja-item pn-esq-pila">
            <Esqueleto ancho="7rem" alto="0.85rem" />
            <Esqueleto ancho="8rem" alto="1.9rem" radio="0.5rem" />
          </div>
        ))}
      </div>
      <div className="pn-tarjeta pn-esq-grafica">
        <Esqueleto ancho="14rem" alto="1.1rem" />
        <div className="pn-esq-barras">
          {ALTURAS.map((h) => (
            <Esqueleto key={h} ancho="100%" alto={h} radio="0.4rem 0.4rem 0.15rem 0.15rem" />
          ))}
        </div>
      </div>
    </Cargando>
  )
}

/** Carga de un listado: cabecera de tabla y filas con bloque de fecha, nombre, aro y cifra. */
export function EsqueletoLista({ filas = 7, conFiltros = true }: { filas?: number; conFiltros?: boolean }) {
  return (
    <Cargando etiqueta="Cargando la lista">
      <EncabezadoEsqueleto />
      {conFiltros ? (
        <div className="pn-esq-filtros">
          <Esqueleto ancho="min(20rem, 100%)" alto="2.75rem" radio="999px" />
          <Esqueleto ancho="13rem" alto="2.75rem" radio="999px" />
        </div>
      ) : null}
      <div className="pn-tarjeta pn-tarjeta--sin-relleno">
        <div className="pn-esq-cabecera-tabla" />
        {IDS.slice(0, filas).map((id, i) => (
          <div key={id} className="pn-esq-fila">
            <Esqueleto ancho="2.75rem" alto="3.1rem" radio="0.7rem" />
            <div className="pn-esq-pila pn-esq-crece">
              <Esqueleto ancho={`${42 + ((i * 17) % 30)}%`} alto="0.95rem" />
              <Esqueleto ancho={`${24 + ((i * 11) % 18)}%`} alto="0.75rem" />
            </div>
            <Esqueleto ancho="1.1rem" alto="1.1rem" radio="50%" />
            <Esqueleto ancho="6rem" alto="1.25rem" />
          </div>
        ))}
      </div>
    </Cargando>
  )
}

/** Carga de una ficha: cifra o nombre protagonista, línea de tiempo y bloques de datos. */
export function EsqueletoDetalle() {
  return (
    <Cargando etiqueta="Cargando la ficha">
      <EncabezadoEsqueleto conVolver />
      <div className="pn-ficha">
        <div className="pn-tarjeta pn-esq-pila pn-esq-linea">
          {IDS.slice(0, 4).map((id) => (
            <div key={id} className="pn-esq-hito">
              <Esqueleto ancho="1.25rem" alto="1.25rem" radio="50%" />
              <div className="pn-esq-pila pn-esq-crece">
                <Esqueleto ancho="40%" alto="0.95rem" />
                <Esqueleto ancho="25%" alto="0.75rem" />
              </div>
            </div>
          ))}
        </div>
        <div className="pn-tarjeta pn-esq-pila">
          {IDS.slice(0, 6).map((id) => (
            <div key={id} className="pn-esq-dato">
              <Esqueleto ancho="30%" alto="0.75rem" />
              <Esqueleto ancho="55%" alto="0.95rem" />
            </div>
          ))}
        </div>
      </div>
    </Cargando>
  )
}
