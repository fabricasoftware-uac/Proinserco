import type { Metadata } from 'next'
import Link from 'next/link'
import { consultarDonaciones } from '@/modules/donaciones/ui/consulta-panel'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { Aro } from '@/shared/ui/panel/aro'
import { EncabezadoPagina, EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'
import { ExportarCsv } from '../_ui/exportar-csv'
import { FiltrosDonaciones, hayFiltros, parametrosBase } from '../_ui/filtros-donaciones'
import { Paginador } from '../_ui/paginador'
import { LIMITE_PAGINA, leerPila, ParametrosDonaciones } from '../_ui/parametros'
import { TablaDonaciones } from '../_ui/tabla-donaciones'
import { construirHref, normalizarParametros, type ParamsCrudos } from '../_ui/url'

export const metadata: Metadata = { title: 'Donaciones' }

const BASE = '/panel/donaciones'

export default async function PaginaDonaciones({ searchParams }: { searchParams: Promise<ParamsCrudos> }) {
  const actor = await requireActor('donaciones:leer')
  const p = ParametrosDonaciones.parse(normalizarParametros(await searchParams))
  const { donaciones } = await obtenerContenedor()

  const consulta = {
    estado: p.estado,
    linea: p.linea,
    q: p.q,
    desde: p.desde,
    hasta: p.hasta,
    minPesos: p.min,
    maxPesos: p.max,
    orden: p.orden,
    dir: p.dir,
    cursor: p.cursor,
    pagina: p.pagina,
    limite: LIMITE_PAGINA,
  } as const
  const r = await consultarDonaciones(donaciones.listarDonaciones, actor, consulta)

  const base = parametrosBase(p)
  const pila = leerPila(p.pila)

  // Orden por columna: la que ya está activa invierte; las demás arrancan en su sentido natural.
  const hrefOrden = (columna: 'fecha' | 'monto' | 'estado') => {
    const dir = p.orden === columna ? (p.dir === 'asc' ? 'desc' : 'asc') : columna === 'estado' ? 'asc' : 'desc'
    return construirHref(BASE, { ...base, orden: columna, dir })
  }

  let anterior: string | null = null
  let siguiente: string | null = null
  let desdeFila = 1
  if (r.modo === 'cursor') {
    desdeFila = (p.cursor ? Math.max(pila.length, 1) : 0) * LIMITE_PAGINA + 1
    if (r.siguienteCursor) {
      siguiente = construirHref(BASE, { ...base, cursor: r.siguienteCursor, pila: [...pila, p.cursor ?? '0'].join(',') })
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
    desdeFila = (p.pagina - 1) * LIMITE_PAGINA + 1
    if (r.hayMas) siguiente = construirHref(BASE, { ...base, pagina: p.pagina + 1 })
    if (p.pagina > 1) anterior = construirHref(BASE, { ...base, pagina: p.pagina - 1 })
  }

  const exportacion = {
    ...(p.estado ? { estado: p.estado } : {}),
    ...(p.linea ? { linea: p.linea } : {}),
    ...(p.q ? { q: p.q } : {}),
    ...(p.desde ? { desde: p.desde } : {}),
    ...(p.hasta ? { hasta: p.hasta } : {}),
    ...(p.min !== undefined ? { minPesos: p.min } : {}),
    ...(p.max !== undefined ? { maxPesos: p.max } : {}),
    orden: p.orden,
    dir: p.dir,
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Donaciones"
        descripcion="Cada donación con su estado, al día. Los datos personales llegan enmascarados."
        acciones={<ExportarCsv filtros={exportacion} total={r.total} puedeExportar={actor.puede('donaciones:exportar')} />}
      />

      <FiltrosDonaciones p={p} />

      {r.modo === 'acotado' ? (
        <p className="pn-aviso pn-tono-info" style={{ marginBottom: '1.25rem' }}>
          <Aro forma="punto" tamano={18} />
          <span>
            Con orden por columna o filtro de monto se trabaja sobre las últimas 1.000 donaciones que cumplen los demás filtros
            {r.truncado ? ' (hay más que no se incluyen)' : ''}.
          </span>
        </p>
      ) : null}

      <Tarjeta sinRelleno>
        {r.filas.length === 0 ? (
          hayFiltros(p) ? (
            <EstadoPanel
              escena="busqueda"
              titulo="Por aquí no pasó ninguna"
              descripcion="Ninguna donación cumple esos filtros. Prueba con otros criterios o quítalos para ver todas."
              accion={
                <Link className="pn-boton pn-boton--primario" href={BASE}>
                  Limpiar filtros
                </Link>
              }
            />
          ) : (
            <EstadoPanel
              escena="mata"
              titulo="Aún nadie ha dado la vuelta por aquí"
              descripcion="Cuando alguien done desde el sitio, su donación aparecerá aquí con su estado, al momento."
              accion={
                <Link className="pn-boton" href="/donar">
                  Ver la página de donación
                </Link>
              }
            />
          )
        ) : (
          <>
            <TablaDonaciones
              filas={r.filas}
              caption={`Donaciones, ordenadas por ${p.orden} ${p.dir === 'asc' ? 'ascendente' : 'descendente'}`}
              orden={p.orden}
              dir={p.dir}
              hrefOrden={{ fecha: hrefOrden('fecha'), monto: hrefOrden('monto'), estado: hrefOrden('estado') }}
            />
            <Paginador
              etiqueta="donaciones"
              desde={desdeFila}
              hasta={desdeFila + r.filas.length - 1}
              total={r.total}
              anterior={anterior}
              siguiente={siguiente}
            />
          </>
        )}
      </Tarjeta>
    </>
  )
}
