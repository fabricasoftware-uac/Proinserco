'use client'

import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { LineaApoyo } from '@/modules/donaciones'
import { NOMBRES_TIPO_DOCUMENTO, TipoDocumento } from '@/modules/donantes'
import { formatearPesos } from '@/shared/lib/formato-moneda'
import { crearDonacionAccion } from './acciones'
import { Campo, CLASE_CONTROL, claseBorde, IconoCandado, IconoEscudo, IconoTarjetaTachada } from './campos'
import { FormularioDonacion } from './esquema'
import { VerificacionAntiBots } from './verificacion-antibots'

type Props = {
  minimoPesos: number
  maximoPesos?: number | undefined
  montosSugeridos: readonly number[]
  montoInicial: number | null
  lineaInicial: LineaApoyo
  antibots: 'memoria' | 'turnstile'
  siteKey: string
  /** Nonce de la CSP para cargar el script de Turnstile. */
  nonce?: string | undefined
}

type ErrorServidor = { codigo: string; mensaje: string; requestId: string; reintentarEnSegundos?: number }
type Errores = Record<string, string>
type Paso = 1 | 2 | 3

function aplanarErroresFormateados(nodo: unknown, prefijo = '', salida: Errores = {}): Errores {
  if (!nodo || typeof nodo !== 'object') return salida
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === '_errors') {
      if (prefijo && Array.isArray(valor) && valor.length > 0) {
        salida[prefijo] = MENSAJES[prefijo] ?? 'Revisa este dato'
      }
      continue
    }
    const ruta = prefijo ? `${prefijo}.${clave}` : clave
    aplanarErroresFormateados(valor, ruta, salida)
  }
  return salida
}

const NOMBRES_LINEA: Record<LineaApoyo, string> = {
  'donde-mas-se-necesite': 'Donde más se necesite',
  educacion: 'Educación',
  salud: 'Salud',
  agricola: 'Agrícola',
}
const CAMPOS_PASO_2 = [
  'donante.nombres',
  'donante.apellidos',
  'donante.tipoDocumento',
  'donante.numeroDocumento',
  'donante.correo',
  'donante.celular',
  'autorizacionDatos',
]
const PASOS = ['Monto', 'Tus datos', 'Confirmar'] as const
/** Nombres de los montos sugeridos (mismo vocabulario que la portada; sin equivalencias de impacto). */
const OBJETOS_MONTO = ['Semilla', 'Mata', 'Árbol', 'Bosque'] as const
/** Nivel del aro del resumen: el monto respecto al mayor sugerido (solo visual). */
function nivelAro(monto: number, sugeridos: readonly number[]) {
  const tope = Math.max(...sugeridos, 1)
  return monto > 0 ? Math.min(1, 0.12 + (monto / tope) * 0.8) : 0.05
}
const FORMATO_MILES = new Intl.NumberFormat('es-CO')

function soloDigitos(v: string): string {
  return v.replace(/\D/g, '').slice(0, 12).replace(/^0+/, '')
}

export function FormularioDonar(props: Props) {
  const { minimoPesos, maximoPesos } = props
  const [paso, setPaso] = useState<Paso>(1)
  const [monto, setMonto] = useState(props.montoInicial ? String(props.montoInicial) : '')
  const [linea, setLinea] = useState<LineaApoyo>(props.lineaInicial)
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | ''>('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [correo, setCorreo] = useState('')
  const [celular, setCelular] = useState('')
  const [autorizo, setAutorizo] = useState(false)
  const [quiereCertificado, setQuiereCertificado] = useState(false)
  const [tokenAntiBots, setTokenAntiBots] = useState('')
  const [reinicioAntiBots, setReinicioAntiBots] = useState(0)
  const [sitioWeb, setSitioWeb] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorServidor, setErrorServidor] = useState<ErrorServidor | null>(null)
  const enviando = useRef(false)
  const clave = useRef<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const avisoError = useRef<HTMLDivElement>(null)
  const primerRender = useRef(true)
  const idBase = useId()
  const idAro = `aro-${idBase.replace(/[^\w-]/g, '')}`

  const montoNumero = monto ? Number(monto) : 0
  const montoValido =
    Number.isSafeInteger(montoNumero) && montoNumero >= minimoPesos && (maximoPesos === undefined || montoNumero <= maximoPesos)

  // Foco al encabezado del paso (no en el primer render: no se roba el foco al cargar).
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reacciona al cambio de paso
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    titulo.current?.focus()
  }, [paso])

  const { execute, isPending } = useAction(crearDonacionAccion, {
    onError: ({ error }) => {
      enviando.current = false
      const s = error.serverError
      if (s) {
        setErrorServidor(s)
        if (s.codigo === 'MONTO_FUERA_DE_RANGO') setPaso(1)
        // Los tokens de Turnstile son de un solo uso: tras cualquier fallo hay que pedir otro.
        if (s.codigo === 'VERIFICACION_ANTIBOTS_FALLIDA' || props.antibots === 'turnstile') {
          setTokenAntiBots('')
          setReinicioAntiBots((n) => n + 1)
        }
      } else if (error.validationErrors) {
        const mapeados = aplanarErroresFormateados(error.validationErrors)
        setErrores(mapeados)
        const fallaPaso2 = Object.keys(mapeados).some((k) => CAMPOS_PASO_2.includes(k) || k === 'donante')
        const soloAntiBots = Boolean(mapeados.tokenAntiBots) && !mapeados.montoPesos && !fallaPaso2
        setErrorServidor({
          codigo: 'VALIDACION_FALLIDA',
          mensaje: soloAntiBots
            ? 'Completa la verificación de seguridad e inténtalo de nuevo.'
            : 'El servidor no aceptó algunos datos. Revisa los campos marcados.',
          requestId: '',
        })
        if (mapeados.montoPesos) setPaso(1)
        else if (fallaPaso2) setPaso(2)
        else if (mapeados.tokenAntiBots) setPaso(3)
        else setPaso(2)
        if (props.antibots === 'turnstile') {
          setTokenAntiBots('')
          setReinicioAntiBots((n) => n + 1)
        }
      } else {
        setErrorServidor({
          codigo: 'RED',
          mensaje: 'No pudimos comunicarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.',
          requestId: '',
        })
      }
      queueMicrotask(() => avisoError.current?.focus())
    },
  })

  /** Cualquier cambio en los datos invalida la clave de idempotencia del intento anterior. */
  function tocar() {
    clave.current = null
    if (errorServidor) setErrorServidor(null)
  }

  function entrada(autorizacionDatos: boolean) {
    return {
      montoPesos: montoNumero,
      linea,
      claveIdempotencia: clave.current ?? crypto.randomUUID(),
      donante: { nombres, apellidos, tipoDocumento, numeroDocumento, correo, celular },
      autorizacionDatos,
      quiereCertificado,
      tokenAntiBots: tokenAntiBots || 'pendiente',
      sitioWeb,
    }
  }

  /** Valida con el MISMO esquema del servidor y devuelve errores en español, por campo. */
  function validar(): Errores {
    const e: Errores = {}
    const r = FormularioDonacion.safeParse(entrada(autorizo))
    if (!montoValido) {
      e.montoPesos =
        maximoPesos !== undefined
          ? `Elige o escribe un monto entre ${formatearPesos(minimoPesos)} y ${formatearPesos(maximoPesos)}`
          : `Elige o escribe un monto de al menos ${formatearPesos(minimoPesos)}`
    }
    if (!r.success) {
      for (const i of r.error.issues) {
        const ruta = i.path.join('.')
        if (e[ruta]) continue
        e[ruta] = MENSAJES[ruta] ?? 'Revisa este dato'
      }
    }
    if (!tokenAntiBots) e.tokenAntiBots = MENSAJES.tokenAntiBots ?? ''
    else delete e.tokenAntiBots
    return e
  }

  function avanzar() {
    const todos = validar()
    const delPaso = paso === 1 ? ['montoPesos'] : CAMPOS_PASO_2
    const mios = Object.fromEntries(Object.entries(todos).filter(([k]) => delPaso.includes(k)))
    setErrores(mios)
    if (Object.keys(mios).length > 0) {
      const primero = Object.keys(mios)[0]
      if (primero) document.getElementById(`${idBase}-${primero}`)?.focus()
      return
    }
    setPaso((paso + 1) as Paso)
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (paso < 3) return avanzar()
    if (enviando.current || isPending) return
    const todos = validar()
    setErrores(todos)
    if (Object.keys(todos).length > 0) {
      if (todos.montoPesos) setPaso(1)
      else if (Object.keys(todos).some((k) => CAMPOS_PASO_2.includes(k))) setPaso(2)
      return
    }
    enviando.current = true
    setErrorServidor(null)
    clave.current ??= crypto.randomUUID()
    if (tipoDocumento === '') return // ya validado arriba; estrecha el tipo
    const datos = entrada(true)
    execute({ ...datos, donante: { ...datos.donante, tipoDocumento }, autorizacionDatos: true, claveIdempotencia: clave.current })
  }

  const id = (c: string) => `${idBase}-${c}`
  const alEscribir = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    tocar()
    set(e.target.value)
  }
  const nombreLinea = NOMBRES_LINEA[linea]

  return (
    <form onSubmit={enviar} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
      <div className="rounded-tarjeta border border-borde-sutil bg-superficie-elevada">
        <ol className="flex gap-2 border-b border-borde-sutil p-4 sm:px-8" aria-label="Pasos de la donación">
          {PASOS.map((nombre, i) => (
            <li
              key={nombre}
              aria-current={paso === i + 1 ? 'step' : undefined}
              className={`flex min-h-9 flex-1 items-center justify-center gap-2 rounded-pastilla px-2 text-micro font-semibold ${
                paso === i + 1 ? 'bg-acento text-sobre-acento' : paso > i + 1 ? 'bg-marca/15 text-texto' : 'text-texto-suave'
              }`}
            >
              <span aria-hidden="true">{i + 1}</span>
              <span className={paso === i + 1 ? '' : 'hidden sm:inline'}>{nombre}</span>
              {paso > i + 1 && <span className="sr-only">(completado)</span>}
            </li>
          ))}
        </ol>

        <div className="space-y-6 p-4 sm:p-8">
          <h2 ref={titulo} tabIndex={-1} className="paso-titulo outline-offset-4">
            {paso === 1 ? '¿Con cuánto quieres ayudar?' : paso === 2 ? 'Cuéntanos quién eres' : 'Revisa y confirma'}
          </h2>

          {errorServidor && (
            <div
              ref={avisoError}
              tabIndex={-1}
              role="alert"
              className="rounded-control border-2 border-peligro bg-superficie p-4"
            >
              <p className="font-semibold text-peligro">{errorServidor.mensaje}</p>
              {errorServidor.requestId && (
                <p className="mt-1 text-micro text-texto-suave">
                  Si el problema continúa, escríbenos con este código de referencia:{' '}
                  <span className="font-mono">{errorServidor.requestId}</span>
                </p>
              )}
            </div>
          )}

          {paso === 1 && (
            <fieldset className="space-y-6">
              <legend className="sr-only">Monto de la donación</legend>
              {/* Montos como objetos (semilla → bosque): tamaños y giros propios, sombra dura. */}
              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                {props.montosSugeridos.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={montoNumero === m}
                    onClick={() => {
                      tocar()
                      setMonto(String(m))
                    }}
                    className={`monto-objeto ${montoNumero === m ? 'monto-objeto-activo' : ''}`}
                  >
                    <span className="monto-objeto-nombre">{OBJETOS_MONTO[i] ?? 'Aporte'}</span>
                    <span className="monto-objeto-valor">{formatearPesos(m)}</span>
                  </button>
                ))}
              </div>
              <Campo
                id={id('montoPesos')}
                etiqueta="O escribe otro monto (en pesos colombianos)"
                ayuda={
                  maximoPesos !== undefined
                    ? `Mínimo ${formatearPesos(minimoPesos)}. Máximo ${formatearPesos(maximoPesos)}.`
                    : `Mínimo ${formatearPesos(minimoPesos)}.`
                }
                error={errores.montoPesos}
              >
                {(aria) => (
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-texto-suave"
                    >
                      $
                    </span>
                    <input
                      id={id('montoPesos')}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="50.000"
                      value={monto ? FORMATO_MILES.format(Number(monto)) : ''}
                      onChange={(e) => {
                        tocar()
                        setMonto(soloDigitos(e.target.value))
                      }}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores.montoPesos))} pl-9 text-realce`}
                      {...aria}
                    />
                  </div>
                )}
              </Campo>
              <fieldset>
                <legend className="mb-2 text-pequeno font-semibold">¿A qué quieres apoyar? (opcional)</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {LineaApoyo.options.map((l) => (
                    <label
                      key={l}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border-2 border-borde-sutil bg-superficie px-4 has-[:checked]:border-acento"
                    >
                      <input
                        type="radio"
                        name="linea"
                        value={l}
                        checked={linea === l}
                        onChange={() => {
                          tocar()
                          setLinea(l)
                        }}
                        className="size-5 accent-[var(--acento)]"
                      />
                      <span>{NOMBRES_LINEA[l]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </fieldset>
          )}

          {paso === 2 && (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo id={id('donante.nombres')} etiqueta="Nombres" error={errores['donante.nombres']}>
                  {(aria) => (
                    <input
                      id={id('donante.nombres')}
                      type="text"
                      autoComplete="given-name"
                      maxLength={80}
                      value={nombres}
                      onChange={alEscribir(setNombres)}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores['donante.nombres']))}`}
                      {...aria}
                    />
                  )}
                </Campo>
                <Campo id={id('donante.apellidos')} etiqueta="Apellidos" error={errores['donante.apellidos']}>
                  {(aria) => (
                    <input
                      id={id('donante.apellidos')}
                      type="text"
                      autoComplete="family-name"
                      maxLength={80}
                      value={apellidos}
                      onChange={alEscribir(setApellidos)}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores['donante.apellidos']))}`}
                      {...aria}
                    />
                  )}
                </Campo>
                <Campo id={id('donante.tipoDocumento')} etiqueta="Tipo de documento" error={errores['donante.tipoDocumento']}>
                  {(aria) => (
                    <select
                      id={id('donante.tipoDocumento')}
                      value={tipoDocumento}
                      onChange={(e) => {
                        tocar()
                        setTipoDocumento(TipoDocumento.safeParse(e.target.value).data ?? '')
                      }}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores['donante.tipoDocumento']))}`}
                      {...aria}
                    >
                      <option value="">Elige una opción</option>
                      {TipoDocumento.options.map((t) => (
                        <option key={t} value={t}>
                          {t} · {NOMBRES_TIPO_DOCUMENTO[t]}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo
                  id={id('donante.numeroDocumento')}
                  etiqueta="Número de documento"
                  error={errores['donante.numeroDocumento']}
                >
                  {(aria) => (
                    <input
                      id={id('donante.numeroDocumento')}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={24}
                      value={numeroDocumento}
                      onChange={alEscribir(setNumeroDocumento)}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores['donante.numeroDocumento']))}`}
                      {...aria}
                    />
                  )}
                </Campo>
                <Campo
                  id={id('donante.correo')}
                  etiqueta="Correo electrónico"
                  ayuda="Aquí te enviaremos el comprobante."
                  error={errores['donante.correo']}
                >
                  {(aria) => (
                    <input
                      id={id('donante.correo')}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={254}
                      value={correo}
                      onChange={alEscribir(setCorreo)}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores['donante.correo']))}`}
                      {...aria}
                    />
                  )}
                </Campo>
                <Campo
                  id={id('donante.celular')}
                  etiqueta="Celular"
                  ayuda="10 dígitos, por ejemplo 300 123 4567."
                  error={errores['donante.celular']}
                >
                  {(aria) => (
                    <input
                      id={id('donante.celular')}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={20}
                      value={celular}
                      onChange={alEscribir(setCelular)}
                      className={`${CLASE_CONTROL} ${claseBorde(Boolean(errores['donante.celular']))}`}
                      {...aria}
                    />
                  )}
                </Campo>
              </div>

              <div>
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    id={id('autorizacionDatos')}
                    type="checkbox"
                    checked={autorizo}
                    onChange={(e) => {
                      tocar()
                      setAutorizo(e.target.checked)
                    }}
                    aria-invalid={Boolean(errores.autorizacionDatos)}
                    aria-describedby={errores.autorizacionDatos ? id('autorizacionDatos-error') : undefined}
                    className="mt-1 size-6 shrink-0 accent-[var(--acento)]"
                  />
                  <span className="text-pequeno">
                    Autorizo a la Fundación Proinserco a tratar mis datos personales para gestionar mi donación, enviarme el
                    comprobante, expedir el certificado si lo pido y contactarme sobre ella, conforme a la{' '}
                    <Link
                      href="/legal/tratamiento-de-datos"
                      target="_blank"
                      rel="noopener"
                      className="font-semibold underline underline-offset-2"
                    >
                      Política de tratamiento de datos
                    </Link>{' '}
                    y al{' '}
                    <Link
                      href="/legal/aviso-de-privacidad"
                      target="_blank"
                      rel="noopener"
                      className="font-semibold underline underline-offset-2"
                    >
                      Aviso de privacidad
                    </Link>
                    . Sé que puedo conocer, corregir o suprimir mis datos cuando quiera.
                  </span>
                </label>
                {errores.autorizacionDatos && (
                  <p id={id('autorizacionDatos-error')} className="mt-1.5 pl-9 text-pequeno font-semibold text-peligro">
                    {errores.autorizacionDatos}
                  </p>
                )}
              </div>

              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={quiereCertificado}
                  onChange={(e) => {
                    tocar()
                    setQuiereCertificado(e.target.checked)
                  }}
                  className="mt-1 size-6 shrink-0 accent-[var(--acento)]"
                />
                <span className="text-pequeno">
                  Quiero certificado de donación{' '}
                  <span className="text-texto-suave">
                    (opcional; está sujeto a lo que permita el régimen tributario de la fundación)
                  </span>
                </span>
              </label>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-5">
              <dl className="divide-y divide-borde-sutil rounded-control border-2 border-borde-sutil bg-superficie px-4 text-cuerpo">
                <Fila t="Monto" v={formatearPesos(montoNumero)} fuerte />
                <Fila t="Apoyas" v={nombreLinea} />
                <Fila t="Donante" v={`${nombres} ${apellidos}`.trim()} />
                <Fila t="Documento" v={`${tipoDocumento} ${numeroDocumento}`.trim()} />
                <Fila t="Correo" v={correo} />
                <Fila t="Celular" v={celular} />
                <Fila t="Certificado" v={quiereCertificado ? 'Sí, lo quiero' : 'No'} />
              </dl>

              <div className="flex gap-3 rounded-control bg-marca/10 p-4 text-pequeno">
                <IconoCandado className="mt-0.5 shrink-0 text-marca" />
                <p>
                  <strong>El pago se hace en la página segura de Openpay.</strong> Aquí nunca te pedimos datos de tarjeta ni de
                  cuentas: al continuar te llevaremos allá y volverás a este sitio al terminar.
                </p>
              </div>

              <VerificacionAntiBots
                modo={props.antibots}
                siteKey={props.siteKey}
                nonce={props.nonce}
                token={tokenAntiBots}
                reinicio={reinicioAntiBots}
                error={errores.tokenAntiBots}
                alCambiar={(t) => {
                  tocar()
                  setTokenAntiBots(t)
                  setErrores((e) => {
                    const { tokenAntiBots: _omitido, ...resto } = e
                    return resto
                  })
                }}
              />

              {/* Honeypot: un humano nunca lo ve ni llega con el teclado; un bot suele rellenarlo. */}
              <div aria-hidden="true" inert className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={id('sitioWeb')}>Deja este campo vacío</label>
                <input
                  id={id('sitioWeb')}
                  name="sitioWeb"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={sitioWeb}
                  onChange={(e) => setSitioWeb(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Barra de acción: pegajosa en móvil, por encima del banner de cookies si está visible. */}
        <div className="sticky bottom-[var(--banner-cookies-alto,0px)] z-10 flex items-center gap-3 rounded-b-tarjeta border-t border-borde-sutil bg-superficie-elevada p-4 sm:px-8">
          {paso > 1 && (
            <button
              type="button"
              onClick={() => setPaso((paso - 1) as Paso)}
              disabled={isPending}
              className="min-h-12 rounded-pastilla border-2 border-borde px-5 font-semibold disabled:opacity-50"
            >
              Atrás
            </button>
          )}
          <p className="min-w-0 flex-1 text-right text-pequeno text-texto-suave lg:hidden" aria-hidden="true">
            {montoValido ? formatearPesos(montoNumero) : ''}
          </p>
          <button
            type="submit"
            // En el paso 3 no se puede pagar sin token de la verificación de seguridad.
            disabled={isPending || (paso === 3 && !tokenAntiBots)}
            className="boton-continuar inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-pastilla bg-acento px-6 text-sobre-acento disabled:cursor-wait disabled:opacity-60 sm:flex-none"
          >
            {paso < 3 ? 'Continuar' : isPending ? 'Preparando tu pago…' : 'Continuar al pago seguro'}
          </button>
        </div>
      </div>

      <aside
        data-seccion-tema="bosque"
        className="resumen-donar h-fit rounded-tarjeta bg-superficie p-6 text-texto lg:sticky lg:top-28"
      >
        <div className="resumen-aro" aria-hidden="true">
          <svg viewBox="0 0 200 200" aria-hidden="true" className="size-full overflow-visible">
            <defs>
              <clipPath id={idAro}>
                <circle cx="100" cy="100" r="58" />
              </clipPath>
            </defs>
            <circle cx="100" cy="100" r="58" className="resumen-aro-fondo" />
            <g clipPath={`url(#${idAro})`}>
              <rect
                x="42"
                y="42"
                width="116"
                height="116"
                className="resumen-aro-liquido"
                style={{ transform: `scaleY(${montoValido ? nivelAro(montoNumero, props.montosSugeridos) : 0.05})` }}
              />
            </g>
            <g transform="scale(2)" fill="none">
              <path d="M18.05 61.63 A34 34 0 1 0 20.56 33" className="resumen-aro-trazo" strokeWidth="6" strokeLinecap="round" />
              <path d="M16.06 40.8 L30.2 36.3 L13.2 26.2 Z" className="resumen-aro-punta" />
            </g>
          </svg>
        </div>
        <h3 className="mt-4 font-enfasis text-t3 italic leading-none">Tu donación</h3>
        <p className="resumen-monto mt-2" aria-live="polite">
          {montoValido ? formatearPesos(montoNumero) : '$ —'}
        </p>
        <p className="mt-2 text-pequeno text-texto-suave">Apoyas: {nombreLinea}</p>
        <ul className="mt-6 space-y-3 border-t border-borde-sutil pt-5 text-pequeno">
          <li className="flex gap-3">
            <IconoCandado className="shrink-0 text-marca" /> Pago en la página segura de Openpay
          </li>
          <li className="flex gap-3">
            <IconoTarjetaTachada className="shrink-0 text-marca" /> Nunca pedimos datos de tarjeta en este sitio
          </li>
          <li className="flex gap-3">
            <IconoEscudo className="shrink-0 text-marca" /> Tus datos se tratan según la Ley 1581 de 2012
          </li>
        </ul>
      </aside>
    </form>
  )
}

const MENSAJES: Record<string, string> = {
  'donante.nombres': 'Escribe tus nombres (solo letras, mínimo 2)',
  'donante.apellidos': 'Escribe tus apellidos (solo letras, mínimo 2)',
  'donante.tipoDocumento': 'Elige el tipo de documento',
  'donante.numeroDocumento': 'Escribe un número de documento válido (4 a 20 caracteres)',
  'donante.correo': 'Escribe un correo válido, por ejemplo nombre@correo.com',
  'donante.celular': 'Escribe un celular colombiano de 10 dígitos que empiece por 3',
  autorizacionDatos: 'Debes autorizar el tratamiento de tus datos para poder donar',
  tokenAntiBots: 'Completa la verificación de seguridad',
  montoPesos: 'Revisa el monto',
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-pequeno text-texto-suave">{t}</dt>
      <dd className={`min-w-0 break-words text-right ${fuerte ? 'font-titular text-realce' : ''}`}>{v || '—'}</dd>
    </div>
  )
}
