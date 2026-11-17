import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { aPaginaAuditoria, type EntradaAuditoriaVM } from '@/modules/auditoria'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { AccionAuditable } from '@/shared/domain/evento-auditable'
import { Aro, Estado } from '@/shared/ui/panel/aro'
import { Fecha } from '@/shared/ui/panel/datos'
import { Icono } from '@/shared/ui/panel/iconos'
import { Identificador } from '@/shared/ui/panel/identificador'
import { EncabezadoPagina, EstadoPanel, Tarjeta, type Tono } from '@/shared/ui/panel/primitivas'
import { SelectorRango } from '@/shared/ui/panel/selector-rango'
import { Paginador } from '../_ui/paginador'
import { LIMITE_PAGINA, leerPila, ParametrosAuditoria } from '../_ui/parametros'
import { construirHref, normalizarParametros, type ParamsCrudos } from '../_ui/url'

export const metadata: Metadata = { title: 'Auditoría' }

const BASE = '/panel/auditoria'
const TOPE_ESCANEO = 1000

const ETIQUETA: Readonly<Record<AccionAuditable, { texto: string; tono: Tono }>> = {
  'sesion.iniciada': { texto: 'Inicio de sesión', tono: 'ok' },
  'sesion.fallida': { texto: 'Inicio de sesión fallido', tono: 'malo' },
  'sesion.mfa_fallido': { texto: 'Segundo factor fallido', tono: 'malo' },
  'sesion.cerrada': { texto: 'Cierre de sesión', tono: 'neutro' },
  'donacion.creada': { texto: 'Donación creada', tono: 'info' },
  'donacion.transicion': { texto: 'Cambio de estado de donación', tono: 'info' },
  'donacion.discrepancia': { texto: 'Discrepancia con la pasarela', tono: 'malo' },
  'donacion.consultada': { texto: 'Donación consultada', tono: 'neutro' },
  'donaciones.exportadas': { texto: 'Exportación de donaciones', tono: 'aviso' },
  'donante.registrado': { texto: 'Donante registrado', tono: 'info' },
  'donante.dato_revelado': { texto: 'Dato de donante revelado', tono: 'aviso' },
  'donantes.exportados': { texto: 'Exportación de donantes', tono: 'aviso' },
  'consentimiento.registrado': { texto: 'Consentimiento registrado', tono: 'info' },
  'ajustes.cambiados': { texto: 'Ajustes cambiados', tono: 'aviso' },
}

const etiquetaAccion = (accion: string) => ETIQUETA[accion as AccionAuditable] ?? { texto: accion, tono: 'neutro' as const }

export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<ParamsCrudos> }) {
  const actor = await requireActor('auditoria:leer')
  const p = ParametrosAuditoria.parse(normalizarParametros(await searchParams))
  const { auditoria } = await obtenerContenedor()

  const filtros = { ...(p.accion ? { accion: p.accion } : {}), ...(p.actor ? { actorId: p.actor } : {}) }
  const conFecha = Boolean(p.desde || p.hasta)
  const base = { accion: p.accion, actor: p.actor, desde: p.desde, hasta: p.hasta }
  const hay = Boolean(p.accion || p.actor || p.desde || p.hasta)

  let filas: readonly EntradaAuditoriaVM[]
  let total: number
  let anterior: string | null = null
  let siguiente: string | null = null
  let desdeFila: number
  let truncado = false

  if (!conFecha) {
    const pagina = aPaginaAuditoria(
      await auditoria.listarAuditoria(filtros, { limite: LIMITE_PAGINA, ...(p.cursor ? { cursor: p.cursor } : {}) }, actor),
    )
    const pila = leerPila(p.pila)
    filas = pagina.elementos
    total = pagina.total
    desdeFila = (p.cursor ? Math.max(pila.length, 1) : 0) * LIMITE_PAGINA + 1
    if (pagina.cursorSiguiente) {
      siguiente = construirHref(BASE, { ...base, cursor: pagina.cursorSiguiente, pila: [...pila, p.cursor ?? '0'].join(',') })
    }
    if (p.cursor) {
      const previo = pila.at(-1)
      anterior = construirHref(BASE, {
        ...base,
        cursor: previo && previo !== '0' ? previo : undefined,
        pila: pila.slice(0, -1).join(',') || undefined,
      })
    }
  } else {
    // El puerto no filtra por fecha: se recorre (acotado) y se filtra aquí por día de Colombia.
    const desde = p.desde ? Date.parse(`${p.desde}T00:00:00-05:00`) : Number.NEGATIVE_INFINITY
    const hasta = p.hasta ? Date.parse(`${p.hasta}T23:59:59.999-05:00`) : Number.POSITIVE_INFINITY
    const todas: EntradaAuditoriaVM[] = []
    let cursor: string | undefined
    for (let vueltas = 0; vueltas < TOPE_ESCANEO / 100; vueltas++) {
      const pagina = aPaginaAuditoria(
        await auditoria.listarAuditoria(filtros, { limite: 100, ...(cursor ? { cursor } : {}) }, actor),
      )
      todas.push(...pagina.elementos)
      if (!pagina.cursorSiguiente) break
      cursor = pagina.cursorSiguiente
      if (vueltas === TOPE_ESCANEO / 100 - 1) truncado = true
    }
    const dentro = todas.filter((e) => {
      const t = Date.parse(e.ocurridoEn)
      return t >= desde && t <= hasta
    })
    total = dentro.length
    desdeFila = (p.pagina - 1) * LIMITE_PAGINA + 1
    filas = dentro.slice(desdeFila - 1, desdeFila - 1 + LIMITE_PAGINA)
    if (desdeFila - 1 + LIMITE_PAGINA < dentro.length) siguiente = construirHref(BASE, { ...base, pagina: p.pagina + 1 })
    if (p.pagina > 1) anterior = construirHref(BASE, { ...base, pagina: p.pagina - 1 })
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        descripcion="Quién hizo qué, cuándo y desde dónde. Un registro de solo lectura: nadie puede editarlo ni borrarlo."
      />

      <search className="pn-filtros-zona">
        <form method="get" action={BASE} className="pn-filtros pn-filtros--auditoria">
          <div>
            <label className="pn-etiqueta" htmlFor="a-accion">
              Acción
            </label>
            <select id="a-accion" className="pn-campo" name="accion" defaultValue={p.accion ?? ''}>
              <option value="">Todas las acciones</option>
              {AccionAuditable.options.map((a) => (
                <option key={a} value={a}>
                  {ETIQUETA[a].texto}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pn-etiqueta" htmlFor="a-actor">
              Quién (id de usuario)
            </label>
            <span className="pn-campo-icono">
              <Icono nombre="donantes" tamano={18} />
              <input
                id="a-actor"
                className="pn-campo pn-mono"
                name="actor"
                defaultValue={p.actor}
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                placeholder="usr_demo_admin"
              />
            </span>
          </div>
          <SelectorRango desde={p.desde} hasta={p.hasta} etiqueta="Fechas" />
          <div className="pn-filtros-acciones">
            <button type="submit" className="pn-boton pn-boton--primario">
              Aplicar
            </button>
            {hay ? (
              <Link className="pn-boton pn-boton--suave" href={BASE}>
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      </search>

      {conFecha ? (
        <p className="pn-aviso pn-tono-info" style={{ marginBottom: '1.25rem' }}>
          <Aro forma="punto" tamano={18} />
          <span>
            El filtro por fecha se aplica sobre los últimos 1.000 eventos que cumplen los demás filtros
            {truncado ? ' (hay más que no se incluyen)' : ''}.
          </span>
        </p>
      ) : null}

      <Tarjeta sinRelleno>
        {filas.length === 0 ? (
          hay ? (
            <EstadoPanel
              escena="busqueda"
              titulo="Nada quedó registrado así"
              descripcion="Ningún evento cumple esos filtros. Prueba con otra acción, otra persona u otras fechas."
              accion={
                <Link className="pn-boton pn-boton--primario" href={BASE}>
                  Quitar filtros
                </Link>
              }
            />
          ) : (
            <EstadoPanel
              escena="vacio"
              titulo="Todo en calma por ahora"
              descripcion="Cada acción del panel y del sitio quedará anotada aquí, con su hora y su autor."
            />
          )
        ) : (
          <>
            <div className="pn-tabla-envoltura pn-tabla-envoltura--tarjetas">
              <table className="pn-tabla">
                <caption className="pn-solo-lectores">Registro de auditoría, del más reciente al más antiguo</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Quién</th>
                    <th scope="col">Sobre qué</th>
                    <th scope="col">IP</th>
                    <th scope="col">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((e, i) => {
                    const et = etiquetaAccion(e.accion)
                    return (
                      <tr key={e.id} className={`pn-tono-${et.tono}`} style={{ '--i': i } as CSSProperties}>
                        <td>
                          <span className="pn-desliza">
                            <Fecha iso={e.ocurridoEn} tono={et.tono} />
                          </span>
                        </td>
                        <th scope="row">
                          <Estado tono={et.tono}>{et.texto}</Estado>
                        </th>
                        <td>
                          <Identificador valor={e.actorId} que="id del actor" discreto />
                        </td>
                        <td className="pn-celda-recurso">
                          <span className="pn-mono">{e.recurso}</span>
                          {e.recursoId ? (
                            <>
                              <br />
                              <Identificador valor={e.recursoId} que="id del recurso" discreto corto />
                            </>
                          ) : null}
                        </td>
                        <td>{e.ip ? <span className="pn-mono">{e.ip}</span> : <span className="pn-guion">—</span>}</td>
                        <td>
                          <Detalles e={e} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="pn-tarjetas-movil" aria-label="Registro de auditoría">
              {filas.map((e, i) => {
                const et = etiquetaAccion(e.accion)
                return (
                  <li key={e.id} className={`pn-tono-${et.tono}`} style={{ '--i': i } as CSSProperties}>
                    <div className="pn-fila-tarjeta pn-fila-tarjeta--sin-lado">
                      <Fecha iso={e.ocurridoEn} tono={et.tono} sinHora />
                      <span className="pn-fila-tarjeta-centro">
                        <Estado tono={et.tono}>{et.texto}</Estado>
                        <small>
                          <Fecha iso={e.ocurridoEn} variante="linea" /> · <span className="pn-mono">{e.actorId}</span>
                        </small>
                        <small className="pn-mono">
                          {e.recurso}
                          {e.recursoId ? ` / ${e.recursoId}` : ''}
                        </small>
                      </span>
                    </div>
                    {Object.keys(e.detalles).length ? (
                      <div className="pn-fila-tarjeta-extra">
                        <Detalles e={e} />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <Paginador
              etiqueta="eventos de auditoría"
              desde={desdeFila}
              hasta={desdeFila + filas.length - 1}
              total={total}
              anterior={anterior}
              siguiente={siguiente}
            />
          </>
        )}
      </Tarjeta>
    </>
  )
}

/** Detalles del evento como pares clave/valor en monoespaciada. */
function Detalles({ e }: { e: EntradaAuditoriaVM }) {
  const pares = Object.entries(e.detalles)
  if (pares.length === 0) return <span className="pn-guion">—</span>
  return (
    <ul className="pn-detalle-kv">
      {pares.map(([k, v]) => (
        <li key={k}>
          <span>{k}</span>
          <span>{v === null ? '—' : String(v)}</span>
        </li>
      ))}
    </ul>
  )
}
