import type { Metadata } from 'next'
import Link from 'next/link'
import { aFilaDonacion, EstadoDonacion } from '@/modules/donaciones'
import { consultarParaExportar } from '@/modules/donaciones/ui/consulta-panel'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { AroProgreso } from '@/shared/ui/panel/aro'
import { Fecha, Monto } from '@/shared/ui/panel/datos'
import { formatearNumero, formatearPorcentaje } from '@/shared/ui/panel/formato'
import { Icono } from '@/shared/ui/panel/iconos'
import { EncabezadoPagina, EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'
import { AroEstado, ETIQUETA_ESTADO, ETIQUETA_LINEA, TONO_ESTADO } from './_ui/estados'
import { GraficaDonaciones } from './_ui/grafica-donaciones'
import { Variacion } from './_ui/indicador'

export const metadata: Metadata = { title: 'Resumen' }

const DIAS = 30
const DIA_MS = 86_400_000

const suma = (valores: readonly number[]) => valores.reduce((a, b) => a + b, 0)

/** Resumen: la cifra protagonista, una franja de indicadores, la gráfica y lo último que pasó. */
export default async function PaginaResumen() {
  const actor = await requireActor('donaciones:leer')
  const c = await obtenerContenedor()
  const ahora = new Date()
  const desde60 = new Date(ahora.getTime() - (DIAS * 2 - 1) * DIA_MS).toISOString().slice(0, 10)

  const [ind30, ind60, recientes, ventana] = await Promise.all([
    c.donaciones.obtenerIndicadores(actor, DIAS),
    c.donaciones.obtenerIndicadores(actor, DIAS * 2),
    c.donaciones.listarDonaciones({}, { limite: 6 }, actor),
    consultarParaExportar(c.donaciones.listarDonaciones, actor, {
      desde: desde60,
      orden: 'fecha',
      dir: 'desc',
      pagina: 1,
      limite: 100,
    }),
  ])

  // Periodo anterior = primeros 30 días de la serie de 60.
  const previo = ind60.serie.slice(0, DIAS)
  const recaudadoPrevio = suma(previo.map((p) => p.montoPesos))
  const aprobadasPrevias = suma(previo.map((p) => p.cantidad))
  const rechazadasPrevias = ind60.rechazadas - ind30.rechazadas
  const resueltasPrevias = aprobadasPrevias + rechazadasPrevias

  // Los datos "por donante" se calculan sobre las filas de la ventana de 60 días (UTC, igual que la serie).
  const inicioActual = ind30.serie[0]?.fecha ?? desde60
  const actuales = ventana.filas.filter((f) => f.creadaEn.slice(0, 10) >= inicioActual)
  const anteriores = ventana.filas.filter((f) => f.creadaEn.slice(0, 10) < inicioActual)
  const unicos = (filas: typeof ventana.filas) =>
    new Set(filas.filter((f) => f.estado === 'aprobada').map((f) => f.donanteId)).size

  const porEstado = EstadoDonacion.options
    .map((estado) => ({ estado, cantidad: actuales.filter((f) => f.estado === estado).length }))
    .filter((e) => e.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad)
  const totalEstados = suma(porEstado.map((e) => e.cantidad))

  const hayDatos = ind60.aprobadas + ind60.pendientes + ind60.rechazadas > 0 || recientes.total > 0

  return (
    <>
      <EncabezadoPagina
        titulo="Resumen"
        descripcion={`Los últimos ${DIAS} días, comparados con los ${DIAS} anteriores.`}
        aparte={<Fecha iso={ahora.toISOString()} variante="titular" />}
      />

      {!hayDatos ? (
        <Tarjeta>
          <EstadoPanel
            escena="mata"
            titulo="Aún nadie ha dado la vuelta por aquí"
            descripcion="Cuando llegue la primera donación verás cuánto entró, cómo va el día a día y quién la hizo."
            accion={
              <Link className="pn-boton pn-boton--primario" href="/donar">
                Ver la página de donación
              </Link>
            }
          />
        </Tarjeta>
      ) : (
        <>
          <section className="pn-heroe" aria-labelledby="h-recaudado">
            <div className="pn-heroe-cifra">
              <h2 id="h-recaudado" className="pn-solo-lectores">
                Total recaudado en los últimos {DIAS} días
              </h2>
              <Monto pesos={ind30.recaudadoPesos} tamano="heroe" codigo />
              <p className="pn-heroe-pie">
                <span>recaudados en los últimos {DIAS} días</span>
                <Variacion actual={ind30.recaudadoPesos} previo={recaudadoPrevio} nota="vs. 30 días previos" />
              </p>
            </div>
            <div className="pn-heroe-aro">
              <AroProgreso
                fraccion={ind30.tasaAprobacion}
                tamano={148}
                grosor={10}
                etiqueta={`Tasa de aprobación: ${formatearPorcentaje(ind30.tasaAprobacion)}`}
              >
                <b aria-hidden="true">{formatearPorcentaje(ind30.tasaAprobacion)}</b>
                <span aria-hidden="true">aprobación</span>
              </AroProgreso>
              <small>
                {formatearNumero(ind30.rechazadas)} rechazadas o expiradas
                <br />
                <Variacion
                  actual={ind30.tasaAprobacion}
                  previo={resueltasPrevias ? aprobadasPrevias / resueltasPrevias : 0}
                  tipo="puntos"
                />
              </small>
            </div>
          </section>

          <section className="pn-franja" aria-label="Otros indicadores">
            <div className="pn-franja-item">
              <p className="pn-franja-valor">
                <span className="pn-franja-numero">{formatearNumero(ind30.aprobadas)}</span>
                <Variacion actual={ind30.aprobadas} previo={aprobadasPrevias} />
              </p>
              <h3>Donaciones aprobadas</h3>
              <span className="pn-franja-nota">{formatearNumero(ind30.pendientes)} siguen pendientes</span>
            </div>
            <div className="pn-franja-item">
              <p className="pn-franja-valor">
                <Monto pesos={ind30.ticketPromedioPesos} tamano="medio" />
                <Variacion
                  actual={ind30.ticketPromedioPesos}
                  previo={aprobadasPrevias ? Math.round(recaudadoPrevio / aprobadasPrevias) : 0}
                />
              </p>
              <h3>Ticket promedio</h3>
              <span className="pn-franja-nota">por donación aprobada</span>
            </div>
            <div className="pn-franja-item">
              <p className="pn-franja-valor">
                <span className="pn-franja-numero">{formatearNumero(unicos(actuales))}</span>
                <Variacion actual={unicos(actuales)} previo={unicos(anteriores)} />
              </p>
              <h3>Donantes únicos</h3>
              <span className="pn-franja-nota">con al menos una aprobada</span>
            </div>
          </section>

          <Tarjeta>
            <GraficaDonaciones serie={ind30.serie} titulo={`Donaciones aprobadas, últimos ${DIAS} días`} />
          </Tarjeta>

          <div className="pn-resumen-bajo">
            <Tarjeta
              titulo="Lo último que pasó"
              id="recientes"
              acciones={
                <Link className="pn-boton pn-boton--chico" href="/panel/donaciones">
                  Ver todas
                  <Icono nombre="flecha-der" tamano={14} />
                </Link>
              }
            >
              <ol className="pn-actividad">
                {recientes.elementos.map((d) => {
                  const f = aFilaDonacion(d)
                  return (
                    <li key={f.id}>
                      <Link href={`/panel/donaciones/${f.id}`}>
                        <span className="pn-actividad-aro">
                          <AroEstado estado={f.estado} tamano={20} />
                        </span>
                        <span className="pn-actividad-texto">
                          <strong>{f.donante}</strong>
                          <span>
                            <span className={`pn-estado-aro pn-tono-${TONO_ESTADO[f.estado]}`}>{ETIQUETA_ESTADO[f.estado]}</span>
                            <Fecha iso={f.creadaEn} variante="relativa" ahora={ahora} />
                            <span>{ETIQUETA_LINEA[f.linea]}</span>
                          </span>
                        </span>
                        <Monto pesos={f.montoPesos} />
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </Tarjeta>

            <Tarjeta
              plana
              titulo="Cómo terminaron"
              nota={`${formatearNumero(totalEstados)} donaciones en los últimos ${DIAS} días`}
              id="estados"
            >
              {totalEstados === 0 ? (
                <p className="pn-tarjeta-nota">Nada que contar todavía en este periodo.</p>
              ) : (
                <>
                  <div
                    className="pn-distribucion"
                    role="img"
                    aria-label={porEstado.map((e) => `${ETIQUETA_ESTADO[e.estado]}: ${e.cantidad}`).join(', ')}
                  >
                    {porEstado.map((e) => (
                      <span key={e.estado} className={`pn-tono-${TONO_ESTADO[e.estado]}`} style={{ flexGrow: e.cantidad }} />
                    ))}
                  </div>
                  <ul className="pn-leyenda">
                    {porEstado.map((e) => (
                      <li key={e.estado} className={`pn-tono-${TONO_ESTADO[e.estado]}`}>
                        <AroEstado estado={e.estado} />
                        <span className="pn-leyenda-nombre">{ETIQUETA_ESTADO[e.estado]}</span>
                        <b>{formatearNumero(e.cantidad)}</b>
                        <small>{formatearPorcentaje(e.cantidad / totalEstados)}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Tarjeta>
          </div>
        </>
      )}
    </>
  )
}
