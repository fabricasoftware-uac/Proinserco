import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { aPaginaDonantes } from '@/modules/donantes'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { Aro } from '@/shared/ui/panel/aro'
import { DatoEnmascarado, Fecha } from '@/shared/ui/panel/datos'
import { iniciales } from '@/shared/ui/panel/formato'
import { Icono } from '@/shared/ui/panel/iconos'
import { EncabezadoPagina, EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'
import { Paginador } from '../_ui/paginador'
import { LIMITE_PAGINA, leerPila, ParametrosDonantes } from '../_ui/parametros'
import { construirHref, normalizarParametros, type ParamsCrudos } from '../_ui/url'

export const metadata: Metadata = { title: 'Donantes' }

const BASE = '/panel/donantes'

export default async function PaginaDonantes({ searchParams }: { searchParams: Promise<ParamsCrudos> }) {
  const actor = await requireActor('donantes:leer')
  const p = ParametrosDonantes.parse(normalizarParametros(await searchParams))
  const { donantes } = await obtenerContenedor()

  const pagina = aPaginaDonantes(
    await donantes.listarDonantes(
      p.q ? { q: p.q } : {},
      { limite: LIMITE_PAGINA, ...(p.cursor ? { cursor: p.cursor } : {}) },
      actor,
    ),
  )

  const pila = leerPila(p.pila)
  const base = { q: p.q }
  const siguiente = pagina.cursorSiguiente
    ? construirHref(BASE, { ...base, cursor: pagina.cursorSiguiente, pila: [...pila, p.cursor ?? '0'].join(',') })
    : null
  const previo = pila.at(-1)
  const anterior = p.cursor
    ? construirHref(BASE, {
        ...base,
        cursor: previo && previo !== '0' ? previo : undefined,
        pila: pila.slice(0, -1).join(',') || undefined,
      })
    : null
  const desdeFila = (p.cursor ? Math.max(pila.length, 1) : 0) * LIMITE_PAGINA + 1

  return (
    <>
      <EncabezadoPagina
        titulo="Donantes"
        descripcion="Las personas que han dado la vuelta con la fundación. Documento, correo y celular llegan enmascarados; revelarlos queda en la auditoría."
      />

      <search className="pn-filtros-zona">
        <form method="get" action={BASE} className="pn-filtros pn-filtros--donantes">
          <div>
            <label className="pn-etiqueta" htmlFor="d-q">
              Buscar por nombre o correo
            </label>
            <span className="pn-campo-icono">
              <Icono nombre="buscar" tamano={18} />
              <input
                id="d-q"
                className="pn-campo"
                type="search"
                name="q"
                defaultValue={p.q}
                minLength={2}
                maxLength={100}
                autoComplete="off"
                placeholder="Ana, ana@…"
              />
            </span>
          </div>
          <div className="pn-filtros-acciones">
            <button type="submit" className="pn-boton pn-boton--primario">
              Buscar
            </button>
            {p.q ? (
              <Link className="pn-boton pn-boton--suave" href={BASE}>
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      </search>

      <Tarjeta sinRelleno>
        {pagina.elementos.length === 0 ? (
          p.q ? (
            <EstadoPanel
              escena="busqueda"
              titulo="Nadie con ese nombre por aquí"
              descripcion="Prueba con otro nombre o con el correo."
              accion={
                <Link className="pn-boton pn-boton--primario" href={BASE}>
                  Ver todos los donantes
                </Link>
              }
            />
          ) : (
            <EstadoPanel
              escena="mata"
              titulo="Aún nadie ha dado la vuelta por aquí"
              descripcion="Los donantes aparecen aquí cuando completan su primera donación."
            />
          )
        ) : (
          <>
            <div className="pn-tabla-envoltura pn-tabla-envoltura--tarjetas">
              <table className="pn-tabla">
                <caption className="pn-solo-lectores">Donantes, del más reciente al más antiguo</caption>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Celular</th>
                    <th scope="col">Certificado</th>
                    <th scope="col">Registro</th>
                    <th scope="col" className="pn-celda-accion">
                      <span className="pn-solo-lectores">Abrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.elementos.map((d, i) => (
                    <tr key={d.id} style={{ '--i': i } as CSSProperties}>
                      <th scope="row">
                        <Link className="pn-persona pn-desliza" href={`/panel/donantes/${d.id}`}>
                          <span className="pn-avatar pn-avatar--chico" aria-hidden="true">
                            {iniciales(d.nombre)}
                          </span>
                          {d.nombre}
                        </Link>
                      </th>
                      <td>
                        <DatoEnmascarado valor={d.correoEnmascarado} />
                      </td>
                      <td>
                        <DatoEnmascarado valor={d.celularEnmascarado} />
                      </td>
                      <td>
                        {d.quiereCertificado ? (
                          <span className="pn-estado-aro pn-tono-info">
                            <Aro forma="punto" tamano={16} />
                            Lo pidió
                          </span>
                        ) : (
                          <span className="pn-guion">No</span>
                        )}
                      </td>
                      <td>
                        <Fecha iso={d.creadoEn} sinHora />
                      </td>
                      <td className="pn-celda-accion">
                        <Link className="pn-fila-ir" href={`/panel/donantes/${d.id}`} tabIndex={-1} aria-hidden="true">
                          <Icono nombre="flecha-der" tamano={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="pn-tarjetas-movil" aria-label="Donantes">
              {pagina.elementos.map((d, i) => (
                <li key={d.id} style={{ '--i': i } as CSSProperties}>
                  <Link className="pn-fila-tarjeta" href={`/panel/donantes/${d.id}`}>
                    <span className="pn-avatar" aria-hidden="true">
                      {iniciales(d.nombre)}
                    </span>
                    <span className="pn-fila-tarjeta-centro">
                      <strong>{d.nombre}</strong>
                      <small>
                        <DatoEnmascarado valor={d.correoEnmascarado} />
                      </small>
                    </span>
                    <Fecha iso={d.creadoEn} variante="dia" />
                  </Link>
                </li>
              ))}
            </ul>
            <Paginador
              etiqueta="donantes"
              desde={desdeFila}
              hasta={desdeFila + pagina.elementos.length - 1}
              total={pagina.total}
              anterior={anterior}
              siguiente={siguiente}
            />
          </>
        )}
      </Tarjeta>
    </>
  )
}
