import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { aFilaDonacion, type DonacionFilaVM } from '@/modules/donaciones'
import { aDetalleDonante, NOMBRES_TIPO_DOCUMENTO } from '@/modules/donantes'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { NoEncontrado } from '@/shared/domain/errores'
import { Aro } from '@/shared/ui/panel/aro'
import { Fecha, Monto } from '@/shared/ui/panel/datos'
import { formatearNumero, iniciales } from '@/shared/ui/panel/formato'
import { Icono } from '@/shared/ui/panel/iconos'
import { EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'
import { ListaConsentimientos } from '../../_ui/consentimientos'
import { IdRecurso } from '../../_ui/parametros'
import { RevelarDato } from '../../_ui/revelar-dato'
import { TablaDonaciones } from '../../_ui/tabla-donaciones'

export const metadata: Metadata = { title: 'Detalle de donante' }

export default async function PaginaDetalleDonante({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('donantes:leer')
  const id = IdRecurso.safeParse((await params).id)
  if (!id.success) notFound()

  const c = await obtenerContenedor()
  const { donante, consentimientos } = await c.donantes.obtenerDonante(id.data, actor).catch((e: unknown) => {
    if (e instanceof NoEncontrado) notFound()
    throw e
  })
  const d = aDetalleDonante(donante, consentimientos)
  const puedeRevelar = actor.puede('donantes:revelar')

  // Historial: las donaciones del donante. El correo completo se usa SOLO en el servidor para buscar.
  let historial: DonacionFilaVM[] | null = null
  if (actor.puede('donaciones:leer')) {
    const pagina = await c.donaciones.listarDonaciones({ q: donante.correo }, { limite: 100 }, actor)
    historial = pagina.elementos.map(aFilaDonacion).filter((f) => f.donanteId === d.id)
  }
  const aprobadas = historial?.filter((f) => f.estado === 'aprobada') ?? []
  const aportado = aprobadas.reduce((a, f) => a + f.montoPesos, 0)

  return (
    <>
      <Link className="pn-volver" href="/panel/donantes">
        <Icono nombre="flecha-izq" tamano={16} />
        Donantes
      </Link>
      <header className="pn-cabecera-ficha">
        <div>
          <div className="pn-nombre-heroe">
            <span className="pn-avatar" aria-hidden="true">
              {iniciales(d.nombre)}
            </span>
            <h1 className="pn-nombre-heroe-texto">{d.nombre}</h1>
          </div>
          <div className="pn-cabecera-ficha-meta">
            <span>
              Donante desde el <Fecha iso={d.creadoEn} variante="dia" />
            </span>
            {d.quiereCertificado ? (
              <span className="pn-estado-aro pn-tono-info">
                <Aro forma="punto" tamano={16} />
                Quiere certificado de donación
              </span>
            ) : null}
          </div>
        </div>
        {historial ? (
          <div className="pn-aportado">
            <Monto pesos={aportado} tamano="grande" />
            <small>
              aportados en {formatearNumero(aprobadas.length)}{' '}
              {aprobadas.length === 1 ? 'donación aprobada' : 'donaciones aprobadas'}
            </small>
          </div>
        ) : null}
      </header>

      <div className="pn-ficha pn-ficha--mitades">
        <Tarjeta
          titulo="Datos personales"
          nota="Enmascarados por defecto. Revelar uno exige permiso y queda auditado."
          id="datos"
        >
          <dl className="pn-datos pn-datos--una">
            <div>
              <dt>Documento ({NOMBRES_TIPO_DOCUMENTO[d.tipoDocumento]})</dt>
              <dd>
                <span className="pn-mono">{d.tipoDocumento}</span>
                <RevelarDato
                  donanteId={d.id}
                  campo="numeroDocumento"
                  etiqueta="número de documento"
                  enmascarado={d.documentoEnmascarado}
                  puedeRevelar={puedeRevelar}
                />
              </dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>
                <RevelarDato
                  donanteId={d.id}
                  campo="correo"
                  etiqueta="correo"
                  enmascarado={d.correoEnmascarado}
                  puedeRevelar={puedeRevelar}
                />
              </dd>
            </div>
            <div>
              <dt>Celular</dt>
              <dd>
                <RevelarDato
                  donanteId={d.id}
                  campo="celular"
                  etiqueta="celular"
                  enmascarado={d.celularEnmascarado}
                  puedeRevelar={puedeRevelar}
                />
              </dd>
            </div>
          </dl>
          {puedeRevelar ? null : (
            <p className="pn-aviso pn-tono-neutro" style={{ marginTop: '1rem' }}>
              <Icono nombre="candado" tamano={18} />
              <span>Tu rol es de solo lectura: puede ver la ficha, pero no revelar datos personales.</span>
            </p>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Autorizaciones"
          nota="Cada finalidad se autoriza por separado, con la versión del texto legal."
          id="consentimientos"
        >
          <ListaConsentimientos items={d.consentimientos} />
        </Tarjeta>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Tarjeta titulo="Sus donaciones" sinRelleno id="historial">
          {historial === null ? (
            <p className="pn-tarjeta-nota" style={{ padding: '0 1.75rem 1.75rem' }}>
              Tu rol no tiene permiso para consultar donaciones.
            </p>
          ) : historial.length === 0 ? (
            <EstadoPanel
              escena="mata"
              titulo="Todavía no hay vueltas"
              descripcion="Esta persona aún no tiene donaciones registradas."
            />
          ) : (
            <TablaDonaciones filas={historial} caption={`Donaciones de ${d.nombre}`} sinDonante />
          )}
        </Tarjeta>
      </div>
    </>
  )
}
