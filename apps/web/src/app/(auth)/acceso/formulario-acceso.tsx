'use client'

import { useAction } from 'next-safe-action/hooks'
import { type CSSProperties, type FormEvent, Fragment, useEffect, useId, useRef, useState } from 'react'
import { iniciarSesionAccion, verificarSegundoFactorAccion } from '@/modules/iam/ui/acciones'
import { Aro } from '@/shared/ui/panel/aro'
import { Icono } from '@/shared/ui/panel/iconos'

type Props = {
  /** Ruta validada en el servidor (solo /panel…). */
  siguiente: string
}

type ErrorVista = Readonly<{ codigo: string; mensaje: string }>

const MENSAJE_BLOQUEO =
  'Demasiados intentos. Por seguridad, el acceso queda bloqueado temporalmente: espera unos minutos antes de volver a intentarlo.'

function formatearEspera(segundos: number): string {
  if (segundos >= 60) {
    const minutos = Math.ceil(segundos / 60)
    return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  }
  return `${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}`
}

function aMensaje(error: {
  serverError?: { codigo: string; mensaje: string; reintentarEnSegundos?: number } | undefined
  validationErrors?: unknown
}): ErrorVista {
  const e = error.serverError
  if (e?.codigo === 'DEMASIADAS_PETICIONES') {
    const segundos = e.reintentarEnSegundos
    const mensaje =
      typeof segundos === 'number' && Number.isFinite(segundos) && segundos > 0
        ? `Demasiados intentos. Por seguridad, el acceso queda bloqueado temporalmente: espera ${formatearEspera(Math.ceil(segundos))} antes de volver a intentarlo.`
        : MENSAJE_BLOQUEO
    return { codigo: e.codigo, mensaje }
  }
  if (e) return { codigo: e.codigo, mensaje: e.mensaje }
  if (error.validationErrors) return { codigo: 'VALIDACION', mensaje: 'Revisa los datos e inténtalo de nuevo.' }
  return { codigo: 'DESCONOCIDO', mensaje: 'No pudimos completar la acción. Inténtalo de nuevo.' }
}

export function FormularioAcceso({ siguiente }: Props) {
  const [paso, setPaso] = useState<'credenciales' | 'codigo'>('credenciales')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<ErrorVista | null>(null)
  const idCorreo = useId()
  const idContrasena = useId()
  const idError = useId()

  const sesion = useAction(iniciarSesionAccion, {
    onSuccess: () => {
      setError(null)
      setCodigo('')
      setPaso('codigo')
    },
    onError: ({ error: e }) => setError(aMensaje(e)),
  })

  const mfa = useAction(verificarSegundoFactorAccion, {
    onError: ({ error: e }) => {
      const vista = aMensaje(e)
      setError(vista)
      setCodigo('')
      // El desafío caducó: hay que volver a escribir correo y contraseña.
      if (vista.codigo === 'DESAFIO_MFA_EXPIRADO') {
        setContrasena('')
        setPaso('credenciales')
      }
    },
  })

  function enviarCredenciales(e: FormEvent) {
    e.preventDefault()
    setError(null)
    sesion.execute({ correo: correo.trim(), contrasena })
  }

  function enviarCodigo(valor: string) {
    setError(null)
    mfa.execute({ codigo: valor, siguiente })
  }

  const ocupado = sesion.isPending || mfa.isPending

  const bloqueado = error?.codigo === 'DEMASIADAS_PETICIONES'

  return (
    <>
      <ol className="pn-pasos" aria-label="Pasos para entrar">
        <li aria-current={paso === 'credenciales' ? 'step' : undefined} data-hecho={paso === 'codigo' ? '' : undefined}>
          <span className="pn-pasos-num" aria-hidden="true">
            {paso === 'codigo' ? <Icono nombre="check" tamano={13} /> : '1'}
          </span>
          Tu cuenta
        </li>
        <li className="pn-pasos-linea" aria-hidden="true" />
        <li aria-current={paso === 'codigo' ? 'step' : undefined}>
          <span className="pn-pasos-num" aria-hidden="true">
            2
          </span>
          Código
        </li>
      </ol>

      <div aria-live="polite" id={idError}>
        {error ? (
          bloqueado ? (
            <div className="pn-alerta pn-alerta--bloqueo pn-tono-aviso" role="alert">
              <Aro forma="girando" tamano={22} />
              <span>
                <strong>Hagamos una pausa</strong>
                {error.mensaje}
              </span>
            </div>
          ) : (
            <p className="pn-alerta pn-tono-malo" key={`${error.codigo}-${error.mensaje}`}>
              <Aro forma="roto" tamano={20} />
              <span>{error.mensaje}</span>
            </p>
          )
        ) : null}
      </div>

      {paso === 'credenciales' ? (
        <form
          key="credenciales"
          className="pn-formulario pn-paso"
          onSubmit={enviarCredenciales}
          noValidate={false}
          aria-describedby={error ? idError : undefined}
        >
          <div>
            <label className="pn-etiqueta" htmlFor={idCorreo}>
              Correo
            </label>
            <input
              id={idCorreo}
              className="pn-campo"
              type="email"
              name="correo"
              autoComplete="username"
              inputMode="email"
              required
              maxLength={254}
              spellCheck={false}
              autoCapitalize="none"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div>
            <label className="pn-etiqueta" htmlFor={idContrasena}>
              Contraseña
            </label>
            <div className="pn-campo-icono">
              <input
                id={idContrasena}
                className="pn-campo"
                type={verContrasena ? 'text' : 'password'}
                name="contrasena"
                autoComplete="current-password"
                required
                maxLength={256}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                style={{ paddingLeft: '0.875rem', paddingRight: '3rem' }}
              />
              <button
                type="button"
                className="pn-boton pn-boton--suave pn-boton--icono pn-boton--chico pn-campo-ojo"
                aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verContrasena}
                onClick={() => setVerContrasena((v) => !v)}
              >
                <Icono nombre={verContrasena ? 'ojo-cerrado' : 'ojo'} tamano={18} />
              </button>
            </div>
          </div>
          <button type="submit" className="pn-boton pn-boton--primario" disabled={ocupado || bloqueado || !correo || !contrasena}>
            {sesion.isPending ? 'Comprobando…' : 'Continuar'}
            {sesion.isPending ? null : <Icono nombre="flecha-der" tamano={18} />}
          </button>
        </form>
      ) : (
        <PasoCodigo
          codigo={codigo}
          setCodigo={setCodigo}
          ocupado={ocupado}
          enviando={mfa.isPending}
          conError={Boolean(error) && !bloqueado}
          onEnviar={enviarCodigo}
          alVolver={() => {
            setError(null)
            setCodigo('')
            setContrasena('')
            setPaso('credenciales')
          }}
        />
      )}
    </>
  )
}

const CELDAS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const

function PasoCodigo({
  codigo,
  setCodigo,
  ocupado,
  enviando,
  conError,
  onEnviar,
  alVolver,
}: {
  codigo: string
  setCodigo: (v: string) => void
  ocupado: boolean
  enviando: boolean
  conError: boolean
  onEnviar: (codigo: string) => void
  alVolver: () => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enfocado, setEnfocado] = useState(false)
  const ultimoEnviado = useRef('')
  const idEntrada = useId()

  useEffect(() => {
    entrada.current?.focus()
  }, [])

  // Al completar los 6 dígitos (escribiendo, pegando o con autocompletado) se envía solo.
  useEffect(() => {
    if (codigo.length === 6 && codigo !== ultimoEnviado.current && !ocupado) {
      ultimoEnviado.current = codigo
      onEnviar(codigo)
    }
    if (codigo.length < 6) ultimoEnviado.current = ''
  }, [codigo, ocupado, onEnviar])

  // Tras un fallo el campo queda vacío: se devuelve el foco para reintentar.
  useEffect(() => {
    if (!ocupado && codigo === '') entrada.current?.focus()
  }, [ocupado, codigo])

  const activa = Math.min(codigo.length, 5)

  return (
    <form
      key="codigo"
      className="pn-formulario pn-paso"
      onSubmit={(e) => {
        e.preventDefault()
        if (codigo.length === 6 && !ocupado) onEnviar(codigo)
      }}
    >
      <p className="pn-otp-texto">Abre tu app autenticadora y escribe los 6 dígitos que ves ahora.</p>
      <div>
        <label className="pn-solo-lectores" htmlFor={idEntrada}>
          Código de verificación de 6 dígitos
        </label>
        <div className="pn-otp" data-error={conError && codigo === '' ? '' : undefined} data-enviando={enviando ? '' : undefined}>
          {CELDAS.map((id, i) => (
            <Fragment key={id}>
              {i === 3 ? <span className="pn-otp-separador" aria-hidden="true" /> : null}
              <div
                className="pn-otp-celda"
                aria-hidden="true"
                data-activa={enfocado && i === activa ? '' : undefined}
                data-llena={codigo[i] ? '' : undefined}
                style={{ '--i': i } as CSSProperties}
              >
                {codigo[i] ?? ''}
              </div>
            </Fragment>
          ))}
          <input
            ref={entrada}
            id={idEntrada}
            className="pn-otp-entrada"
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            spellCheck={false}
            value={codigo}
            disabled={enviando}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setEnfocado(false)}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
      </div>
      <button type="submit" className="pn-boton pn-boton--primario" disabled={ocupado || codigo.length !== 6}>
        {enviando ? 'Verificando…' : 'Entrar al panel'}
        {enviando ? null : <Icono nombre="flecha-der" tamano={18} />}
      </button>
      <button type="button" className="pn-boton pn-boton--suave" onClick={alVolver} disabled={enviando}>
        Usar otra cuenta
      </button>
    </form>
  )
}
