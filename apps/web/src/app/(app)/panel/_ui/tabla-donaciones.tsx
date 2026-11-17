import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { DonacionFilaVM } from '@/modules/donaciones'
import { DatoEnmascarado, Fecha, Monto } from '@/shared/ui/panel/datos'
import { Icono } from '@/shared/ui/panel/iconos'
import { Identificador } from '@/shared/ui/panel/identificador'
import { AroEstado, EstadoDonacionAro, ETIQUETA_ESTADO, ETIQUETA_LINEA, TONO_ESTADO } from './estados'

type Columna = 'fecha' | 'monto' | 'estado'

type Props = {
  filas: readonly DonacionFilaVM[]
  caption: string
  /** Sin orden: encabezados fijos (p. ej. el historial de un donante). */
  orden?: Columna
  dir?: 'asc' | 'desc'
  /** Enlace que alterna el orden de cada columna ordenable. */
  hrefOrden?: Readonly<Record<Columna, string>>
  /** Ocultar la columna del donante (ya se sabe quién es). */
  sinDonante?: boolean
}

function Encabezado({
  columna,
  etiqueta,
  orden,
  dir,
  href,
  alinear,
}: {
  columna: Columna
  etiqueta: string
  orden?: Columna | undefined
  dir?: 'asc' | 'desc' | undefined
  href?: string | undefined
  alinear?: 'der'
}) {
  if (!href || !orden) {
    return (
      <th scope="col" className={alinear === 'der' ? 'pn-der' : undefined}>
        {etiqueta}
      </th>
    )
  }
  const activa = orden === columna
  return (
    <th
      scope="col"
      aria-sort={activa ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={alinear === 'der' ? 'pn-der' : undefined}
    >
      <Link href={href} className="pn-orden" scroll={false}>
        {etiqueta}
        <Icono nombre={activa ? (dir === 'asc' ? 'orden-asc' : 'orden-desc') : 'orden-ambos'} tamano={14} />
        <span className="pn-solo-lectores">
          {activa ? `, ordenado ${dir === 'asc' ? 'ascendente' : 'descendente'}` : ', ordenar'}
        </span>
      </Link>
    </th>
  )
}

/** Tabla semántica en escritorio (cabecera fija, acento por estado, acciones al pasar); tarjetas en móvil. */
export function TablaDonaciones({ filas, caption, orden, dir, hrefOrden, sinDonante = false }: Props) {
  return (
    <>
      <div className="pn-tabla-envoltura pn-tabla-envoltura--tarjetas">
        <table className="pn-tabla">
          <caption className="pn-solo-lectores">{caption}</caption>
          <thead>
            <tr>
              <Encabezado columna="fecha" etiqueta="Fecha" orden={orden} dir={dir} href={hrefOrden?.fecha} />
              {sinDonante ? null : <th scope="col">Donante</th>}
              <th scope="col">Referencia</th>
              <th scope="col">Línea</th>
              <Encabezado columna="estado" etiqueta="Estado" orden={orden} dir={dir} href={hrefOrden?.estado} />
              <Encabezado columna="monto" etiqueta="Monto" orden={orden} dir={dir} href={hrefOrden?.monto} alinear="der" />
              <th scope="col" className="pn-celda-accion">
                <span className="pn-solo-lectores">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id} className={`pn-tono-${TONO_ESTADO[f.estado]}`} style={{ '--i': i } as CSSProperties}>
                <td>
                  <span className="pn-desliza">
                    <Fecha iso={f.creadaEn} tono={TONO_ESTADO[f.estado]} />
                  </span>
                </td>
                {sinDonante ? null : (
                  <th scope="row">
                    <span className="pn-celda-persona">
                      <strong>{f.donante}</strong>
                      <small>
                        <DatoEnmascarado valor={f.correoEnmascarado} />
                      </small>
                    </span>
                  </th>
                )}
                <td>
                  <Identificador valor={f.referencia} href={`/panel/donaciones/${f.id}`} que="referencia" discreto />
                </td>
                <td className="pn-celda-suave">{ETIQUETA_LINEA[f.linea]}</td>
                <td>
                  <EstadoDonacionAro estado={f.estado} />
                </td>
                <td className="pn-der">
                  <Monto pesos={f.montoPesos} />
                </td>
                <td className="pn-celda-accion">
                  <Link className="pn-fila-ir" href={`/panel/donaciones/${f.id}`} tabIndex={-1} aria-hidden="true">
                    <Icono nombre="flecha-der" tamano={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="pn-tarjetas-movil" aria-label={caption}>
        {filas.map((f, i) => (
          <li key={f.id} className={`pn-tono-${TONO_ESTADO[f.estado]}`} style={{ '--i': i } as CSSProperties}>
            <Link className="pn-fila-tarjeta" href={`/panel/donaciones/${f.id}`}>
              <Fecha iso={f.creadaEn} tono={TONO_ESTADO[f.estado]} sinHora />
              <span className="pn-fila-tarjeta-centro">
                <strong>{sinDonante ? ETIQUETA_LINEA[f.linea] : f.donante}</strong>
                <small>
                  {sinDonante ? '' : `${ETIQUETA_LINEA[f.linea]} · `}
                  <span className="pn-mono">{f.referencia}</span>
                </small>
              </span>
              <span className="pn-fila-tarjeta-lado">
                <Monto pesos={f.montoPesos} />
                <span className={`pn-estado-aro pn-tono-${TONO_ESTADO[f.estado]}`}>
                  <AroEstado estado={f.estado} tamano={15} />
                  {ETIQUETA_ESTADO[f.estado]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
