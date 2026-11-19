import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReintentoConsulta } from '@/flujos/donar/reintento-consulta'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { obtenerContenedor } from '@/server/container'
import { contextoPeticion } from '@/server/contexto-peticion'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { DemasiadasPeticiones, NoEncontrado } from '@/shared/domain/errores'
import { formatearPesos } from '@/shared/lib/formato-moneda'

export const metadata: Metadata = { title: 'Resultado de tu donación', robots: { index: false, follow: false } }

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' })

/** Consultas por IP a esta página (la página pendiente se refresca sola cada pocos segundos). */
const LIMITE_CONSULTAS_POR_IP = 60
const VENTANA_CONSULTAS_SEGUNDOS = 300

/**
 * Lee el estado desde NUESTRO servidor con el rol PÚBLICO acotado (una donación por
 * referencia, sin datos personales) y, si sigue pendiente, concilia con la pasarela
 * como mucho una vez cada N segundos por donación. Límite de tasa por IP.
 * Cualquier parámetro que añada la pasarela a la URL (status, id…) se ignora:
 * volver aquí no confirma nada.
 */
export default async function PaginaResultadoDonacion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { referencia } = await searchParams
  const { donaciones, transversal } = await obtenerContenedor()
  const { ip } = await contextoPeticion()
  const limite = await transversal.limitador.consumir(
    `resultado-donacion:ip:${ip}`,
    LIMITE_CONSULTAS_POR_IP,
    VENTANA_CONSULTAS_SEGUNDOS,
  )
  if (!limite.permitido) throw new DemasiadasPeticiones(limite.reintentarEnSegundos)
  const resultado = await ejecutarConContextoDb({ modo: 'publico' }, () => donaciones.consultarResultado(referencia)).catch(
    (e: unknown) => {
      if (e instanceof NoEncontrado) notFound()
      throw e
    },
  )
  const { estado, montoPesos } = resultado
  const { contacto } = CONTENIDO_SITIO
  const fechaDonacion = FORMATO_FECHA.format(resultado.fecha)

  const tema = estado === 'aprobada' ? 'bosque' : estado === 'pendiente' ? 'sol' : 'crema'
  const titulo =
    estado === 'aprobada'
      ? '¡Gracias por tu donación!'
      : estado === 'pendiente'
        ? 'Estamos confirmando tu pago'
        : 'No pudimos completar el pago'
  const mensaje =
    estado === 'aprobada'
      ? 'Tu aporte ya está con nosotros y va directo a los proyectos comunitarios de la fundación en el Cauca.'
      : estado === 'pendiente'
        ? 'Tu banco aún no nos confirma el resultado. No tienes que volver a pagar: esta página se actualiza sola y, cuando se confirme, te escribiremos.'
        : 'El pago fue rechazado y no se cobró nada. Puedes intentarlo de nuevo con el mismo u otro medio de pago.'

  return (
    <main
      data-seccion-tema="crema"
      data-nav="crema"
      data-nav-titulo="Tu donación"
      className="min-h-dvh bg-superficie px-gutter pb-16 pt-28 text-texto"
    >
      <div className="mx-auto max-w-2xl">
        <section
          data-seccion-tema={tema}
          data-estado={estado}
          aria-labelledby="titulo-resultado"
          className="rounded-tarjeta border border-borde-sutil bg-superficie p-6 text-texto sm:p-10"
        >
          <Icono estado={estado} />
          <h1 id="titulo-resultado" data-lineas="" className="resultado-titulo mega mt-5">
            <span className="l">
              <span className="l-in">{titulo}</span>
            </span>
          </h1>
          <p data-rev="subir" className="mt-4 text-realce">
            {mensaje}
          </p>

          <dl className="resultado-datos mt-8">
            <div className="resultado-monto">
              <dt className="font-enfasis text-realce italic">Monto</dt>
              <dd className="resultado-monto-cifra">{formatearPesos(montoPesos)}</dd>
            </div>
            <div className="resultado-fecha">
              <dt className="sr-only">Fecha de la donación</dt>
              <dd>
                <span className="sr-only">{fechaDonacion}</span>
                <span aria-hidden="true" className="resultado-fecha-bloque">
                  <span className="resultado-fecha-dia">{parteFecha(resultado.fecha, 'day')}</span>
                  <span className="resultado-fecha-mes">{parteFecha(resultado.fecha, 'month')}</span>
                  <span className="resultado-fecha-anio">
                    {parteFecha(resultado.fecha, 'year')} · {parteFecha(resultado.fecha, 'hour')}:
                    {parteFecha(resultado.fecha, 'minute')} {parteFecha(resultado.fecha, 'dayPeriod')}
                  </span>
                </span>
              </dd>
            </div>
            <div className="resultado-referencia">
              <dt className="font-enfasis italic">Referencia</dt>
              <dd className="break-all font-mono text-pequeno">{resultado.referencia}</dd>
            </div>
          </dl>

          {estado === 'pendiente' && <ReintentoConsulta />}

          <div className="mt-8 text-cuerpo">
            <h2 className="font-enfasis text-t3 italic">Qué sigue</h2>
            {estado === 'aprobada' && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Te enviaremos el comprobante al correo que nos diste.</li>
                {resultado.quiereCertificado ? (
                  <li>
                    Pediste certificado de donación: lo tramitaremos con tus datos; la fundación te escribirá si necesita algo
                    más.
                  </li>
                ) : null}
                <li>Guarda la referencia: te servirá si necesitas escribirnos.</li>
              </ul>
            )}
            {estado === 'pendiente' && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Guarda la referencia y no repitas el pago todavía.</li>
                <li>Si en un rato no ves cambios, escríbenos con la referencia.</li>
              </ul>
            )}
            {estado === 'rechazada' && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Revisa que tu medio de pago tenga fondos y cupo, o prueba con otro.</li>
                <li>Si el banco te informó un cobro, escríbenos con la referencia y lo revisamos.</li>
              </ul>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {estado === 'rechazada' && (
              <Link
                href={`/donar?monto=${montoPesos}`}
                className="inline-flex min-h-12 items-center rounded-pastilla bg-acento px-6 font-semibold text-sobre-acento"
              >
                Intentar de nuevo
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex min-h-12 items-center rounded-pastilla border-2 border-borde px-6 font-semibold"
            >
              Volver al inicio
            </Link>
          </div>

          <p className="mt-8 border-t border-borde-sutil pt-5 text-pequeno text-texto-suave">
            ¿Dudas? Escríbenos por WhatsApp al{' '}
            <a
              href={contacto.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir por WhatsApp al ${contacto.telefono}`}
              className="font-semibold underline underline-offset-2"
            >
              {contacto.telefono}
            </a>{' '}
            o escríbenos a{' '}
            <a href={`mailto:${contacto.correo}`} className="font-semibold underline underline-offset-2">
              {contacto.correo}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

/** Una parte de la fecha (día, mes…) en Bogotá, para la fecha con diseño propio. */
function parteFecha(fecha: Date, tipo: Intl.DateTimeFormatPartTypes) {
  return FORMATO_FECHA.formatToParts(fecha).find((p) => p.type === tipo)?.value ?? ''
}

/**
 * Estado con la flecha de la marca: aprobada = el aro se cierra con un check;
 * pendiente = medio aro que gira despacio; rechazada = aro abierto con una equis.
 */
function Icono({ estado }: { estado: 'aprobada' | 'pendiente' | 'rechazada' }) {
  const marca = estado === 'aprobada' ? 'm38 52 9 9 17-19' : estado === 'pendiente' ? 'M50 36v15l9 6' : 'M40 40l20 20M60 40 40 60'
  return (
    <span className="resultado-icono" data-estado={estado}>
      <svg viewBox="0 0 100 100" width="88" height="88" fill="none" aria-hidden="true">
        {estado === 'aprobada' ? (
          <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="8" />
        ) : (
          <path
            className={estado === 'pendiente' ? 'resultado-icono-gira' : undefined}
            d={estado === 'pendiente' ? 'M50 12a38 38 0 0 1 38 38' : 'M18.05 61.63 A34 34 0 1 0 20.56 33'}
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}
        <path d={marca} stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
