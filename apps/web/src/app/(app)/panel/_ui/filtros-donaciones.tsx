import Link from 'next/link'
import { EstadoDonacion, LineaApoyo } from '@/modules/donaciones'
import { Fecha, Monto } from '@/shared/ui/panel/datos'
import { HojaFiltros } from '@/shared/ui/panel/hoja-filtros'
import { Icono } from '@/shared/ui/panel/iconos'
import { SelectorRango } from '@/shared/ui/panel/selector-rango'
import { AroEstado, ETIQUETA_ESTADO, ETIQUETA_LINEA } from './estados'
import type { ParametrosDonaciones } from './parametros'
import { construirHref } from './url'

const BASE = '/panel/donaciones'

/** Parámetros que se conservan al cambiar de filtro (la paginación se reinicia). */
export function parametrosBase(p: ParametrosDonaciones) {
  return {
    q: p.q,
    estado: p.estado,
    linea: p.linea,
    desde: p.desde,
    hasta: p.hasta,
    min: p.min,
    max: p.max,
    orden: p.orden === 'fecha' ? undefined : p.orden,
    dir: p.orden === 'fecha' && p.dir === 'desc' ? undefined : p.dir,
  }
}

export function hayFiltros(p: ParametrosDonaciones) {
  return Boolean(p.q || p.estado || p.linea || p.desde || p.hasta || p.min !== undefined || p.max !== undefined)
}

export function FiltrosDonaciones({ p }: { p: ParametrosDonaciones }) {
  const base = parametrosBase(p)
  const sin = (...claves: (keyof typeof base)[]) => {
    const copia: Record<string, string | number | undefined> = { ...base }
    for (const c of claves) copia[c] = undefined
    return construirHref(BASE, copia)
  }

  const chips = [
    ...(p.q ? [{ clave: 'q', contenido: <>“{p.q}”</>, texto: `búsqueda ${p.q}`, href: sin('q') }] : []),
    ...(p.linea ? [{ clave: 'linea', contenido: <>{ETIQUETA_LINEA[p.linea]}</>, texto: 'línea', href: sin('linea') }] : []),
    ...(p.desde || p.hasta
      ? [
          {
            clave: 'fechas',
            contenido: (
              <>
                {p.desde ? <Fecha dia={p.desde} variante="dia" /> : 'el inicio'} –{' '}
                {p.hasta ? <Fecha dia={p.hasta} variante="dia" /> : 'hoy'}
              </>
            ),
            texto: 'fechas',
            href: sin('desde', 'hasta'),
          },
        ]
      : []),
    ...(p.min !== undefined
      ? [
          {
            clave: 'min',
            contenido: (
              <>
                desde <Monto pesos={p.min} />
              </>
            ),
            texto: 'monto mínimo',
            href: sin('min'),
          },
        ]
      : []),
    ...(p.max !== undefined
      ? [
          {
            clave: 'max',
            contenido: (
              <>
                hasta <Monto pesos={p.max} />
              </>
            ),
            texto: 'monto máximo',
            href: sin('max'),
          },
        ]
      : []),
  ]
  const activos = chips.length

  return (
    <div className="pn-filtros-zona">
      <nav aria-label="Filtrar por estado">
        <ul className="pn-estados-filtro">
          <li>
            <Link
              className="pn-chip-estado pn-chip-todas"
              href={sin('estado')}
              aria-current={p.estado ? undefined : 'true'}
              scroll={false}
            >
              Todas
            </Link>
          </li>
          {EstadoDonacion.options.map((e) => (
            <li key={e}>
              <Link
                className="pn-chip-estado"
                href={construirHref(BASE, { ...base, estado: e })}
                aria-current={p.estado === e ? 'true' : undefined}
                scroll={false}
              >
                <AroEstado estado={e} tamano={16} />
                {ETIQUETA_ESTADO[e]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <HojaFiltros activos={activos}>
        <search>
          <form method="get" action={BASE} className="pn-filtros">
            {p.estado ? <input type="hidden" name="estado" value={p.estado} /> : null}
            {p.orden !== 'fecha' || p.dir !== 'desc' ? (
              <>
                <input type="hidden" name="orden" value={p.orden} />
                <input type="hidden" name="dir" value={p.dir} />
              </>
            ) : null}
            <div>
              <label className="pn-etiqueta" htmlFor="f-q">
                Buscar
              </label>
              <span className="pn-campo-icono">
                <Icono nombre="buscar" tamano={18} />
                <input
                  id="f-q"
                  className="pn-campo"
                  type="search"
                  name="q"
                  defaultValue={p.q}
                  minLength={2}
                  maxLength={100}
                  placeholder="Referencia o correo"
                  autoComplete="off"
                />
              </span>
            </div>
            <SelectorRango desde={p.desde} hasta={p.hasta} etiqueta="Fechas" />
            <div>
              <label className="pn-etiqueta" htmlFor="f-linea">
                Línea de apoyo
              </label>
              <select id="f-linea" className="pn-campo" name="linea" defaultValue={p.linea ?? ''}>
                <option value="">Todas las líneas</option>
                {LineaApoyo.options.map((l) => (
                  <option key={l} value={l}>
                    {ETIQUETA_LINEA[l]}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="pn-campo-grupo">
              <legend className="pn-etiqueta">Monto (COP)</legend>
              <div className="pn-montos">
                <label>
                  <span className="pn-solo-lectores">Monto mínimo en pesos</span>
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    name="min"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    placeholder="mínimo"
                    defaultValue={p.min}
                  />
                </label>
                <span className="pn-montos-guion" aria-hidden="true">
                  –
                </span>
                <label>
                  <span className="pn-solo-lectores">Monto máximo en pesos</span>
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    name="max"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    placeholder="máximo"
                    defaultValue={p.max}
                  />
                </label>
              </div>
            </fieldset>
            <div className="pn-filtros-acciones">
              <button type="submit" className="pn-boton pn-boton--primario">
                Aplicar
              </button>
            </div>
          </form>
        </search>
      </HojaFiltros>

      {chips.length > 0 ? (
        <ul className="pn-chips" aria-label="Filtros activos">
          {chips.map((c) => (
            <li key={c.clave}>
              <Link className="pn-chip" href={c.href} scroll={false}>
                {c.contenido}
                <span className="pn-chip-quitar" aria-hidden="true">
                  <Icono nombre="cerrar" tamano={12} />
                </span>
                <span className="pn-solo-lectores">: quitar filtro de {c.texto}</span>
              </Link>
            </li>
          ))}
          {chips.length > 1 ? (
            <li>
              <Link className="pn-boton pn-boton--suave pn-boton--chico" href={BASE}>
                Quitar todo
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
