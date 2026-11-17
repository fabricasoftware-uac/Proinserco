'use client'

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatearPesos } from '@/shared/lib/formato-moneda'
import { Fecha, Monto } from '@/shared/ui/panel/datos'
import { formatearCompacto, formatearNumero, partesDia } from '@/shared/ui/panel/formato'
import { Icono } from '@/shared/ui/panel/iconos'

type Punto = Readonly<{ fecha: string; montoPesos: number; cantidad: number }>
type Modo = 'dia' | 'semana'
type Barra = Readonly<{ dia: string; descripcion: string; montoPesos: number; cantidad: number }>

const MARGEN = { arriba: 44, derecha: 64, abajo: 34, izquierda: 4 }
const DIA_MS = 86_400_000

const textoDia = (ymd: string) => {
  const p = partesDia(ymd)
  return `${p.dia} de ${p.mes}`
}

/** Agrupa por semana ISO (lunes) en UTC, igual que la serie del servidor. */
function agrupar(serie: readonly Punto[], modo: Modo): Barra[] {
  if (modo === 'dia') {
    return serie.map((p) => ({ dia: p.fecha, descripcion: textoDia(p.fecha), montoPesos: p.montoPesos, cantidad: p.cantidad }))
  }
  const semanas = new Map<number, { inicio: number; montoPesos: number; cantidad: number }>()
  for (const p of serie) {
    const t = Date.parse(`${p.fecha}T00:00:00Z`)
    const diaSemana = (new Date(t).getUTCDay() + 6) % 7
    const inicio = t - diaSemana * DIA_MS
    const actual = semanas.get(inicio) ?? { inicio, montoPesos: 0, cantidad: 0 }
    actual.montoPesos += p.montoPesos
    actual.cantidad += p.cantidad
    semanas.set(inicio, actual)
  }
  return [...semanas.values()]
    .sort((a, b) => a.inicio - b.inicio)
    .map((s) => {
      const dia = new Date(s.inicio).toISOString().slice(0, 10)
      return { dia, descripcion: `Semana del ${textoDia(dia)}`, montoPesos: s.montoPesos, cantidad: s.cantidad }
    })
}

/** Techo "redondo" para el eje: 1, 2, 2.5, 5 × 10^n. */
function techoRedondo(max: number): number {
  if (max <= 0) return 100_000
  const exp = 10 ** Math.floor(Math.log10(max))
  const f = max / exp
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return paso * exp
}

/** Barra con esquinas superiores redondeadas (la base queda recta, apoyada en el eje). */
function barraRedondeada(x: number, y: number, w: number, h: number) {
  const r = Math.min(w / 2, 7, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}

export function GraficaDonaciones({ serie, titulo }: { serie: readonly Punto[]; titulo: string }) {
  const [modo, setModo] = useState<Modo>('dia')
  const [ancho, setAncho] = useState(720)
  const [activo, setActivo] = useState<number | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const idDesc = useId()
  const idDegradado = useId().replace(/:/g, '')

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAncho(Math.max(280, Math.floor(entrada.contentRect.width)))
    })
    observador.observe(el)
    setAncho(Math.max(280, Math.floor(el.clientWidth)))
    return () => observador.disconnect()
  }, [])

  const barras = useMemo(() => agrupar(serie, modo), [serie, modo])
  const total = barras.reduce((a, b) => a + b.montoPesos, 0)
  const cantidadTotal = barras.reduce((a, b) => a + b.cantidad, 0)
  const maximo = Math.max(0, ...barras.map((b) => b.montoPesos))
  const techo = techoRedondo(maximo)
  const promedio = barras.length ? total / barras.length : 0

  const compacto = ancho < 520
  const margen = compacto ? { ...MARGEN, derecha: 52 } : MARGEN
  const alto = compacto ? 230 : 300
  const w = ancho - margen.izquierda - margen.derecha
  const h = alto - margen.arriba - margen.abajo
  const banda = w / Math.max(1, barras.length)
  const anchoBarra = Math.min(modo === 'dia' ? 22 : 56, Math.max(4, banda * 0.62))
  const cadaN = Math.max(1, Math.ceil(barras.length / Math.max(2, Math.floor(w / 46))))
  const y = (v: number) => margen.arriba + h - (v / techo) * h
  const iPico = maximo > 0 ? barras.findIndex((b) => b.montoPesos === maximo) : -1
  const pico = iPico >= 0 ? barras[iPico] : undefined

  const activa = activo !== null ? barras[activo] : undefined
  const resumen = `${titulo}: ${formatearPesos(total)} en ${formatearNumero(cantidadTotal)} donaciones aprobadas${
    pico ? `. El mayor ${modo === 'dia' ? 'día' : 'periodo'} fue ${pico.descripcion} con ${formatearPesos(pico.montoPesos)}` : ''
  }. Promedio por ${modo === 'dia' ? 'día' : 'semana'}: ${formatearPesos(Math.round(promedio))}.`

  const inicios = barras.flatMap((b, i) =>
    i === 0 || partesDia(barras[i - 1]?.dia ?? b.dia).mes0 !== partesDia(b.dia).mes0 ? [i] : [],
  )
  const centroX = (i: number) => margen.izquierda + i * banda + banda / 2

  return (
    <figure className="pn-grafica-figura" style={{ margin: 0 }}>
      <div className="pn-grafica-cab">
        <div>
          <h2 className="pn-grafica-titulo">Lo que entró, día a día</h2>
          <p>
            <Monto pesos={total} /> en {formatearNumero(cantidadTotal)} {cantidadTotal === 1 ? 'aprobada' : 'aprobadas'} · últimos
            30 días
          </p>
        </div>
        <div className="pn-segmentos" style={{ '--pn-i': modo === 'dia' ? 0 : 1, '--pn-n': 2 } as CSSProperties}>
          <button type="button" aria-pressed={modo === 'dia'} onClick={() => setModo('dia')}>
            Día
          </button>
          <button type="button" aria-pressed={modo === 'semana'} onClick={() => setModo('semana')}>
            Semana
          </button>
        </div>
      </div>

      <div className="pn-grafica" ref={contenedor} data-activa={activa ? '' : undefined}>
        <svg
          key={modo}
          width={ancho}
          height={alto}
          viewBox={`0 0 ${ancho} ${alto}`}
          role="img"
          aria-labelledby={`${idTitulo} ${idDesc}`}
          onPointerMove={(e) => {
            const caja = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - caja.left - margen.izquierda
            const i = Math.floor(x / banda)
            setActivo(i >= 0 && i < barras.length ? i : null)
          }}
          onPointerLeave={() => setActivo(null)}
        >
          <title id={idTitulo}>{titulo}</title>
          <desc id={idDesc}>{resumen}</desc>
          <defs>
            <linearGradient
              id={idDegradado}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={margen.arriba + h}
              x2="0"
              y2={margen.arriba}
            >
              <stop offset="0" className="pn-stop-baja" />
              <stop offset="1" className="pn-stop-alta" />
            </linearGradient>
          </defs>

          {[0.5, 1].map((f) => (
            <g key={f}>
              <line
                className="pn-grafica-rejilla"
                x1={margen.izquierda}
                x2={ancho - margen.derecha}
                y1={y(techo * f)}
                y2={y(techo * f)}
              />
              <text x={ancho - margen.derecha + 10} y={y(techo * f) + 4}>
                ${formatearCompacto(techo * f)}
              </text>
            </g>
          ))}
          <line
            className="pn-grafica-base"
            x1={margen.izquierda}
            x2={ancho - margen.derecha}
            y1={margen.arriba + h}
            y2={margen.arriba + h}
          />

          {barras.map((b, i) => {
            const x = centroX(i) - anchoBarra / 2
            const alturaBarra = b.montoPesos > 0 ? Math.max(4, (b.montoPesos / techo) * h) : 0
            const p = partesDia(b.dia)
            const nuevoMes = i === 0 || partesDia(barras[i - 1]?.dia ?? b.dia).mes0 !== p.mes0
            return (
              <g key={b.dia}>
                {alturaBarra > 0 ? (
                  <path
                    className="pn-barra"
                    data-activa={activo === i ? '' : undefined}
                    d={barraRedondeada(x, margen.arriba + h - alturaBarra, anchoBarra, alturaBarra)}
                    fill={`url(#${idDegradado})`}
                    style={{ '--i': i } as CSSProperties}
                  />
                ) : (
                  <rect
                    className="pn-grafica-vacio"
                    x={centroX(i) - 1.5}
                    y={margen.arriba + h - 3}
                    width={3}
                    height={3}
                    rx={1.5}
                  />
                )}
                {nuevoMes || (i % cadaN === 0 && !inicios.some((m) => m !== i && Math.abs(m - i) < Math.max(2, cadaN))) ? (
                  <text x={centroX(i)} y={alto - 14} textAnchor="middle">
                    {p.dia}
                  </text>
                ) : null}
                {nuevoMes ? (
                  <text className="pn-eje-mes" x={centroX(i)} y={alto - 1} textAnchor="middle">
                    {p.mes}
                  </text>
                ) : null}
              </g>
            )
          })}

          {promedio > 0 ? (
            <g>
              <line
                className="pn-grafica-promedio"
                x1={margen.izquierda}
                x2={ancho - margen.derecha}
                y1={y(promedio)}
                y2={y(promedio)}
              />
              <text className="pn-promedio-etiqueta" x={ancho - margen.derecha + 10} y={y(promedio) + 4}>
                prom.
              </text>
            </g>
          ) : null}

          {pico ? (
            <g className="pn-grafica-pico">
              <circle cx={centroX(iPico)} cy={y(pico.montoPesos) - 12} r={6.5} />
              <path className="pn-pico-punta" d={`M${centroX(iPico) + 4.2} ${y(pico.montoPesos) - 21.5}l3.6 3.4-4.8 1.2Z`} />
              <text
                className="pn-pico-valor"
                x={Math.min(Math.max(centroX(iPico), 40), ancho - margen.derecha - 30)}
                y={y(pico.montoPesos) - 26}
                textAnchor="middle"
              >
                ${formatearCompacto(pico.montoPesos)}
              </text>
            </g>
          ) : null}

          {activa && activo !== null ? (
            <line
              className="pn-grafica-guia"
              x1={centroX(activo)}
              x2={centroX(activo)}
              y1={margen.arriba - 8}
              y2={margen.arriba + h}
            />
          ) : null}
        </svg>

        {activa && activo !== null ? (
          <div
            className="pn-grafica-info"
            aria-hidden="true"
            style={{
              left: Math.min(Math.max(centroX(activo), 110), ancho - 110),
              top: Math.max(y(activa.montoPesos) - 6, 64),
            }}
          >
            {modo === 'dia' ? (
              <Fecha dia={activa.dia} variante="tabla" tono={activa.montoPesos > 0 ? 'ok' : 'neutro'} />
            ) : (
              <span className="pn-grafica-semana">
                sem.
                <br />
                {partesDia(activa.dia).dia}
              </span>
            )}
            <span>
              <Monto pesos={activa.montoPesos} tamano="medio" />
              <small>
                {modo === 'semana' ? `${activa.descripcion} · ` : ''}
                {activa.cantidad} {activa.cantidad === 1 ? 'donación aprobada' : 'donaciones aprobadas'}
              </small>
            </span>
          </div>
        ) : null}
      </div>

      <details className="pn-detalles">
        <summary>
          <Icono nombre="chevron-der" tamano={14} />
          Ver los datos en una tabla
        </summary>
        <div className="pn-detalles-tabla">
          <table className="pn-tabla">
            <caption className="pn-solo-lectores">{`${titulo}, por ${modo === 'dia' ? 'día' : 'semana'}`}</caption>
            <thead>
              <tr>
                <th scope="col">{modo === 'dia' ? 'Día' : 'Semana'}</th>
                <th scope="col" className="pn-der">
                  Aprobadas
                </th>
                <th scope="col" className="pn-der">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {barras.map((b) => (
                <tr key={b.dia}>
                  <th scope="row">
                    {modo === 'semana' ? <span className="pn-celda-suave">Semana del </span> : null}
                    <Fecha dia={b.dia} variante="dia" />
                  </th>
                  <td className="pn-der">{formatearNumero(b.cantidad)}</td>
                  <td className="pn-der">
                    <Monto pesos={b.montoPesos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
