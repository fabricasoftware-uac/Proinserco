'use client'

import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { Fecha } from './datos'
import { nombreMes } from './formato'
import { Icono } from './iconos'

type Props = {
  desde?: string | undefined
  hasta?: string | undefined
  /** Nombres de los campos del formulario GET. */
  nombreDesde?: string
  nombreHasta?: string
  etiqueta?: string
}

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const
const SEMANA_LARGA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const

const aYmd = (d: Date) => d.toISOString().slice(0, 10)
const deYmd = (ymd: string) => new Date(`${ymd}T00:00:00Z`)
const sumarDias = (ymd: string, n: number) => aYmd(new Date(deYmd(ymd).getTime() + n * 86_400_000))
const hoyColombia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

function sumarMeses(ymd: string, n: number) {
  const d = deYmd(ymd)
  const dia = d.getUTCDate()
  const objetivo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  const ultimo = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate()
  objetivo.setUTCDate(Math.min(dia, ultimo))
  return aYmd(objetivo)
}

/** 6 semanas que cubren el mes de `ymd`, empezando en lunes. */
function semanasDelMes(ymd: string): string[][] {
  const d = deYmd(ymd)
  const primero = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const desfase = (primero.getUTCDay() + 6) % 7
  const inicio = aYmd(new Date(primero.getTime() - desfase * 86_400_000))
  return Array.from({ length: 6 }, (_, s) => Array.from({ length: 7 }, (_, i) => sumarDias(inicio, s * 7 + i)))
}

/**
 * Rango de fechas con calendario propio (sin <input type="date"> a la vista).
 * Rejilla navegable con teclado: flechas, Inicio/Fin (semana), RePág/AvPág (mes),
 * Intro o Espacio para elegir, Escape para cerrar. Escribe AAAA-MM-DD en campos ocultos.
 */
export function SelectorRango({ desde, hasta, nombreDesde = 'desde', nombreHasta = 'hasta', etiqueta = 'Fechas' }: Props) {
  const [inicio, setInicio] = useState<string | undefined>(desde)
  const [fin, setFin] = useState<string | undefined>(hasta)
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState<string>(desde ?? hoyColombia())
  const [hoy, setHoy] = useState<string>('')
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const rejilla = useRef<HTMLTableElement>(null)
  const idCal = useId()
  const idEtiqueta = useId()

  useEffect(() => setHoy(hoyColombia()), [])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  // biome-ignore lint/correctness/useExhaustiveDependencies: mover el foco cuando cambia el día enfocado
  useEffect(() => {
    if (!abierto) return
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-ymd="${foco}"]`)?.focus()
  }, [foco, abierto])

  function abrir() {
    setFoco(inicio ?? hoyColombia())
    setAbierto(true)
  }
  function cerrar() {
    setAbierto(false)
    boton.current?.focus()
  }

  function elegir(ymd: string) {
    if (!inicio || fin) {
      setInicio(ymd)
      setFin(undefined)
    } else if (ymd < inicio) {
      setFin(inicio)
      setInicio(ymd)
    } else {
      setFin(ymd)
    }
    setFoco(ymd)
  }

  function teclas(e: KeyboardEvent) {
    const enSemana = (deYmd(foco).getUTCDay() + 6) % 7
    let destino: string | null = null
    switch (e.key) {
      case 'ArrowRight':
        destino = sumarDias(foco, 1)
        break
      case 'ArrowLeft':
        destino = sumarDias(foco, -1)
        break
      case 'ArrowDown':
        destino = sumarDias(foco, 7)
        break
      case 'ArrowUp':
        destino = sumarDias(foco, -7)
        break
      case 'PageDown':
        destino = sumarMeses(foco, e.shiftKey ? 12 : 1)
        break
      case 'PageUp':
        destino = sumarMeses(foco, e.shiftKey ? -12 : -1)
        break
      case 'Home':
        destino = sumarDias(foco, -enSemana)
        break
      case 'End':
        destino = sumarDias(foco, 6 - enSemana)
        break
    }
    if (destino) {
      e.preventDefault()
      setFoco(destino)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    }
  }

  const d = deYmd(foco)
  const mes0 = d.getUTCMonth()
  const anio = d.getUTCFullYear()
  const semanas = semanasDelMes(foco)
  const enRango = (ymd: string) => Boolean(inicio && fin && ymd > inicio && ymd < fin)

  return (
    <div className="pn-rango" ref={contenedor}>
      <span className="pn-etiqueta" id={idEtiqueta}>
        {etiqueta}
      </span>
      <input type="hidden" name={nombreDesde} value={inicio ?? ''} />
      <input type="hidden" name={nombreHasta} value={fin ?? ''} />
      <button
        ref={boton}
        type="button"
        className="pn-rango-boton"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? idCal : undefined}
        aria-labelledby={`${idEtiqueta} ${idCal}-valor`}
        onClick={() => (abierto ? cerrar() : abrir())}
      >
        <Icono nombre="calendario" tamano={18} />
        <span className="pn-rango-valor" id={`${idCal}-valor`}>
          {inicio ? (
            <>
              <Fecha dia={inicio} variante="linea" />
              <span className="pn-rango-guion" aria-hidden="true">
                –
              </span>
              {fin ? <Fecha dia={fin} variante="linea" /> : <span className="pn-rango-vacio">elige el final</span>}
            </>
          ) : (
            <span className="pn-rango-vacio">Cualquier fecha</span>
          )}
        </span>
        <Icono nombre="chevron-abajo" tamano={14} />
      </button>

      {abierto ? (
        <div className="pn-calendario" id={idCal} role="dialog" aria-label="Elegir rango de fechas" onKeyDown={teclas}>
          <div className="pn-calendario-cab">
            <p className="pn-calendario-mes" aria-live="polite">
              {nombreMes(mes0).replace(/^./, (c) => c.toUpperCase())} <span>{anio}</span>
            </p>
            <div className="pn-calendario-nav">
              <button
                type="button"
                className="pn-boton pn-boton--suave pn-boton--icono pn-boton--chico"
                aria-label="Mes anterior"
                onClick={() => setFoco(sumarMeses(foco, -1))}
              >
                <Icono nombre="chevron-izq" tamano={16} />
              </button>
              <button
                type="button"
                className="pn-boton pn-boton--suave pn-boton--icono pn-boton--chico"
                aria-label="Mes siguiente"
                onClick={() => setFoco(sumarMeses(foco, 1))}
              >
                <Icono nombre="chevron-der" tamano={16} />
              </button>
            </div>
          </div>
          <table className="pn-calendario-tabla" ref={rejilla} aria-label={`${nombreMes(mes0)} de ${anio}`}>
            <thead>
              <tr>
                {SEMANA.map((s, i) => (
                  <th key={SEMANA_LARGA[i]} scope="col" abbr={SEMANA_LARGA[i]}>
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanas.map((semana) => (
                <tr key={semana[0]}>
                  {semana.map((ymd) => {
                    const fd = deYmd(ymd)
                    const esInicio = ymd === inicio
                    const esFin = ymd === fin
                    const elegido = esInicio || esFin
                    return (
                      <td
                        key={ymd}
                        data-en-rango={enRango(ymd) ? '' : undefined}
                        data-inicio={esInicio ? '' : undefined}
                        data-fin={esFin ? '' : undefined}
                        data-con-fin={esInicio && fin ? '' : undefined}
                      >
                        <button
                          type="button"
                          className="pn-dia"
                          data-ymd={ymd}
                          data-fuera={fd.getUTCMonth() !== mes0 ? '' : undefined}
                          data-hoy={ymd === hoy ? '' : undefined}
                          tabIndex={ymd === foco ? 0 : -1}
                          aria-pressed={elegido}
                          aria-label={`${fd.getUTCDate()} de ${nombreMes(fd.getUTCMonth())} de ${fd.getUTCFullYear()}${
                            ymd === hoy ? ', hoy' : ''
                          }${esInicio ? ', inicio del rango' : ''}${esFin ? ', final del rango' : ''}${
                            enRango(ymd) ? ', dentro del rango' : ''
                          }`}
                          onClick={() => elegir(ymd)}
                        >
                          {fd.getUTCDate()}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pn-calendario-pie">
            <button
              type="button"
              className="pn-boton pn-boton--suave pn-boton--chico"
              onClick={() => {
                setInicio(undefined)
                setFin(undefined)
              }}
            >
              Limpiar
            </button>
            <span className="pn-calendario-ayuda" aria-live="polite">
              {!inicio ? 'Elige el primer día' : !fin ? 'Ahora el último' : 'Rango listo'}
            </span>
            <button type="button" className="pn-boton pn-boton--primario pn-boton--chico" onClick={cerrar}>
              Listo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
