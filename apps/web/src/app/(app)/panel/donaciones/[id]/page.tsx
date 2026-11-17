import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { aDetalleDonacion, type EstadoDonacion } from '@/modules/donaciones'
import { aDetalleDonante } from '@/modules/donantes'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { NoEncontrado } from '@/shared/domain/errores'
import { Aro } from '@/shared/ui/panel/aro'
import { DatoEnmascarado, Fecha, Monto } from '@/shared/ui/panel/datos'
import { Icono } from '@/shared/ui/panel/iconos'
import { Identificador } from '@/shared/ui/panel/identificador'
import { EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'
import { ListaConsentimientos } from '../../_ui/consentimientos'
import { AroEstado, EstadoDonacionAro, ETIQUETA_ESTADO, ETIQUETA_LINEA, TONO_ESTADO } from '../../_ui/estados'
import { IdRecurso } from '../../_ui/parametros'

export const metadata: Metadata = { title: 'Detalle de donación' }

const ORIGEN: Readonly<Record<string, string>> = {
  servidor: 'Registrada por el sistema',
  conciliacion: 'Conciliación con la pasarela',
  webhook: 'Aviso de la pasarela',
  panel: 'Desde el panel de administración',
}

export default async function PaginaDetalleDonacion({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('donaciones:leer')
  const id = IdRecurso.safeParse((await params).id)
  if (!id.success) notFound()

  const c = await obtenerContenedor()
  const donacion = await c.donaciones.obtenerDonacion(id.data, actor).catch((e: unknown) => {
    if (e instanceof NoEncontrado) notFound()
    throw e
  })
  const d = aDetalleDonacion(donacion)

  // El consentimiento vive en el donante: solo se consulta con el permiso correspondiente.
  const puedeVerDonante = actor.puede('donantes:leer')
  const donante = puedeVerDonante
    ? await c.donantes
        .obtenerDonante(d.donanteId, actor)
        .then((r) => aDetalleDonante(r.donante, r.consentimientos))
        .catch((e: unknown) => {
          if (e instanceof NoEncontrado) return null
          throw e
        })
    : null

  const lineaTiempo: { estado: EstadoDonacion; en: string; origen: string }[] = [
    { estado: 'creada', en: d.creadaEn, origen: 'servidor' },
    ...d.historial.map((t) => ({ estado: t.hacia, en: t.en, origen: t.origen })),
  ]

  return (
    <>
      <Link className="pn-volver" href="/panel/donaciones">
        <Icono nombre="flecha-izq" tamano={16} />
        Donaciones
      </Link>
      <header className="pn-cabecera-ficha">
        <div>
          <h1>
            <span className="pn-solo-lectores">Donación de </span>
            <Monto pesos={d.montoPesos} tamano="heroe" codigo />
          </h1>
          <div className="pn-cabecera-ficha-meta">
            <EstadoDonacionAro estado={d.estado} grande />
            <span>
              de <strong>{d.donante}</strong> para <strong>{ETIQUETA_LINEA[d.linea]}</strong>
            </span>
            <Identificador valor={d.referencia} que="referencia" />
          </div>
        </div>
        <Fecha iso={d.creadaEn} variante="ficha" tono={TONO_ESTADO[d.estado]} />
      </header>

      <div className="pn-ficha">
        <Tarjeta titulo="Su recorrido" nota="Cada cambio de estado ocurre en el servidor." id="tiempo">
          <ol className="pn-hitos">
            {lineaTiempo.map((t, i) => (
              <li
                key={`${t.estado}-${t.en}`}
                className={`pn-tono-${TONO_ESTADO[t.estado]}`}
                aria-current={i === lineaTiempo.length - 1 ? 'step' : undefined}
              >
                <span className="pn-hito-marca">
                  <AroEstado estado={t.estado} tamano={18} />
                </span>
                <span className="pn-hito-texto">
                  <strong>{ETIQUETA_ESTADO[t.estado]}</strong>
                  <Fecha iso={t.en} variante="linea" />
                  <small>{ORIGEN[t.origen] ?? t.origen}</small>
                </span>
              </li>
            ))}
          </ol>
        </Tarjeta>

        <div className="pn-ficha-columna">
          <Tarjeta titulo="La transacción" id="transaccion">
            <dl className="pn-datos">
              <div>
                <dt>Referencia</dt>
                <dd>
                  <Identificador valor={d.referencia} que="referencia" />
                </dd>
              </div>
              <div>
                <dt>Id de cargo en la pasarela</dt>
                <dd>
                  {d.idCargo ? (
                    <Identificador valor={d.idCargo} que="id de cargo" />
                  ) : (
                    <span className="pn-guion">Sin cargo todavía</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>
                  <Monto pesos={d.montoPesos} codigo />
                </dd>
              </div>
              <div>
                <dt>Método de pago</dt>
                <dd>{d.metodoPago ?? <span className="pn-guion">Aún no definido</span>}</dd>
              </div>
              <div>
                <dt>Línea de apoyo</dt>
                <dd>{ETIQUETA_LINEA[d.linea]}</dd>
              </div>
              <div>
                <dt>Certificado</dt>
                <dd>
                  {d.quiereCertificado ? (
                    <span className="pn-estado-aro pn-tono-ok">
                      <Aro forma="cerrado" tamano={16} />
                      Lo solicitó
                    </span>
                  ) : (
                    <span className="pn-guion">No lo pidió</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Creada</dt>
                <dd>
                  <Fecha iso={d.creadaEn} variante="linea" />
                </dd>
              </div>
              <div>
                <dt>Último cambio</dt>
                <dd>
                  <Fecha iso={d.actualizadaEn} variante="linea" />
                </dd>
              </div>
            </dl>
            <p className="pn-aviso pn-tono-info" style={{ marginTop: '1.25rem' }}>
              <Icono nombre="candado" tamano={18} />
              <span>El pago ocurre en la pasarela: este sistema nunca recibe ni guarda datos de tarjeta.</span>
            </p>
          </Tarjeta>

          <Tarjeta
            titulo="Quién donó"
            id="donante"
            acciones={
              puedeVerDonante ? (
                <Link className="pn-boton pn-boton--chico" href={`/panel/donantes/${d.donanteId}`}>
                  Ver ficha
                  <Icono nombre="flecha-der" tamano={14} />
                </Link>
              ) : null
            }
          >
            <dl className="pn-datos">
              <div>
                <dt>Nombre</dt>
                <dd>{d.donante}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>
                  <DatoEnmascarado valor={d.correoEnmascarado} />
                </dd>
              </div>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Autorizaciones de datos" nota="Tratamiento de datos personales (Ley 1581)." id="consentimiento">
            {!puedeVerDonante ? (
              <p className="pn-tarjeta-nota">Tu rol no tiene permiso para consultar donantes ni sus autorizaciones.</p>
            ) : donante ? (
              <ListaConsentimientos items={donante.consentimientos} />
            ) : (
              <EstadoPanel
                escena="busqueda"
                titulo="No encontramos la ficha"
                descripcion="Esta donación no tiene una ficha de donante asociada con autorizaciones."
              />
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  )
}
