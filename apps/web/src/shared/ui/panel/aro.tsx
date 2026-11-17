import type { CSSProperties, ReactNode } from 'react'

/**
 * La flecha circular del logo como motivo del panel: estados, progreso,
 * indicadores e ilustraciones salen de la misma geometria (un aro de r=7.5
 * en una rejilla de 20, con la cabeza de flecha de la marca).
 * Todo es decorativo (aria-hidden): el texto que acompaña pone el nombre.
 */

export type Tono = 'ok' | 'aviso' | 'malo' | 'neutro' | 'info' | 'contra'

/** Forma del aro: el estado se reconoce por la forma, no solo por el color. */
export type FormaAro = 'cerrado' | 'girando' | 'abierto' | 'roto' | 'punteado' | 'invertido' | 'marca' | 'punto'

export const FORMA_POR_TONO: Readonly<Record<Tono, FormaAro>> = {
  ok: 'cerrado',
  aviso: 'marca',
  malo: 'roto',
  neutro: 'abierto',
  info: 'punto',
  contra: 'marca',
}

const R = 7.5
const C = 10

/** Punto del aro a `grados` (0 = arriba, sentido horario). */
function punto(grados: number, r = R): [number, number] {
  const rad = (grados * Math.PI) / 180
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)]
}

/** Arco del aro entre dos ángulos (horario). */
export function arco(desde: number, hasta: number, r = R): string {
  const [x0, y0] = punto(desde, r)
  const [x1, y1] = punto(hasta, r)
  const grande = hasta - desde > 180 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/** Cabeza de flecha (chevron) en el extremo de un arco horario que termina en `grados`. */
function cabeza(grados: number, r = R, largo = 2.6): string {
  const [x, y] = punto(grados, r)
  const rad = (grados * Math.PI) / 180
  // tangente horaria
  const tx = Math.cos(rad)
  const ty = Math.sin(rad)
  // normal (hacia fuera)
  const nx = Math.sin(rad)
  const ny = -Math.cos(rad)
  const bx = x - tx * largo
  const by = y - ty * largo
  const a = [bx + nx * largo * 0.85, by + ny * largo * 0.85]
  const b = [bx - nx * largo * 0.85, by - ny * largo * 0.85]
  return `M${a[0]?.toFixed(2)} ${a[1]?.toFixed(2)}L${x.toFixed(2)} ${y.toFixed(2)}L${b[0]?.toFixed(2)} ${b[1]?.toFixed(2)}`
}

const FORMAS: Readonly<Record<FormaAro, ReactNode>> = {
  cerrado: (
    <>
      <circle cx={C} cy={C} r={R} />
      <path d="M6.7 10.3l2.2 2.2 4.4-4.6" />
    </>
  ),
  girando: (
    <g className="pn-aro-gira">
      <path d={arco(20, 290)} />
      <path d={cabeza(290)} />
    </g>
  ),
  abierto: (
    <>
      <path d={arco(35, 325)} />
      <circle cx={C} cy={C} r={1.4} className="pn-aro-relleno" />
    </>
  ),
  roto: (
    <>
      <path d={arco(60, 160)} />
      <path d={arco(200, 340)} />
      <path d="M12.6 7.4l-5.2 5.2" />
    </>
  ),
  punteado: <circle cx={C} cy={C} r={R} strokeDasharray="0.01 3.14" />,
  invertido: (
    <g transform="matrix(-1 0 0 1 20 0)">
      <path d={arco(20, 290)} />
      <path d={cabeza(290)} />
    </g>
  ),
  marca: (
    <>
      <circle cx={C} cy={C} r={R} />
      <path d="M10 6.3v4.4" />
      <circle cx={C} cy={13.6} r={0.6} className="pn-aro-relleno" />
    </>
  ),
  punto: (
    <>
      <circle cx={C} cy={C} r={R} />
      <circle cx={C} cy={C} r={2.4} className="pn-aro-relleno" />
    </>
  ),
}

/** Glifo de estado: un aro con forma propia, en el color del tono. */
export function Aro({ forma, tono, tamano = 18 }: { forma: FormaAro; tono?: Tono | undefined; tamano?: number }) {
  return (
    <svg
      className={`pn-aro${tono ? ` pn-tono-${tono}` : ''}`}
      data-forma={forma}
      width={tamano}
      height={tamano}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {FORMAS[forma]}
    </svg>
  )
}

/** Estado completo: aro + etiqueta. Sustituye a las píldoras de texto. */
export function Estado({
  tono,
  forma,
  children,
  grande,
}: {
  tono: Tono
  forma?: FormaAro | undefined
  children: ReactNode
  grande?: boolean | undefined
}) {
  return (
    <span className={grande ? `pn-estado-aro pn-estado-aro--grande pn-tono-${tono}` : `pn-estado-aro pn-tono-${tono}`}>
      <Aro forma={forma ?? FORMA_POR_TONO[tono]} tamano={grande ? 22 : 16} />
      <span>{children}</span>
    </span>
  )
}

/**
 * Aro de progreso con la cabeza de flecha de la marca: el arco crece en
 * sentido horario hasta `fraccion` y termina en flecha. Se dibuja al entrar.
 */
export function AroProgreso({
  fraccion,
  tamano = 120,
  grosor = 9,
  children,
  etiqueta,
}: {
  fraccion: number
  tamano?: number
  grosor?: number
  children?: ReactNode
  etiqueta?: string
}) {
  const f = Math.max(0, Math.min(1, fraccion))
  const r = 50 - grosor / 2 - 4
  const circ = 2 * Math.PI * r
  const angulo = f * 360
  const rad = (angulo * Math.PI) / 180
  const px = 50 + r * Math.sin(rad)
  const py = 50 - r * Math.cos(rad)
  const tx = Math.cos(rad)
  const ty = Math.sin(rad)
  const nx = Math.sin(rad)
  const ny = -Math.cos(rad)
  const l = grosor * 0.95
  return (
    <span className="pn-aro-progreso" style={{ width: tamano, height: tamano }}>
      {etiqueta ? <span className="pn-solo-lectores">{etiqueta}</span> : null}
      <svg viewBox="0 0 100 100" width={tamano} height={tamano} aria-hidden="true" focusable="false">
        <circle className="pn-aro-progreso-pista" cx="50" cy="50" r={r} strokeWidth={grosor} fill="none" />
        {f > 0.005 ? (
          <>
            <circle
              className="pn-aro-progreso-arco"
              cx="50"
              cy="50"
              r={r}
              strokeWidth={grosor}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(circ * f).toFixed(2)} ${circ.toFixed(2)}`}
              transform="rotate(-90 50 50)"
              style={{ '--pn-largo': `${(circ * f).toFixed(2)}` } as CSSProperties}
            />
            <path
              className="pn-aro-progreso-punta"
              d={`M${(px - tx * l * 0.2 + nx * l).toFixed(2)} ${(py - ty * l * 0.2 + ny * l).toFixed(2)}L${(px + tx * l).toFixed(2)} ${(py + ty * l).toFixed(2)}L${(px - tx * l * 0.2 - nx * l).toFixed(2)} ${(py - ty * l * 0.2 - ny * l).toFixed(2)}Z`}
            />
          </>
        ) : null}
      </svg>
      {children ? <span className="pn-aro-progreso-centro">{children}</span> : null}
    </span>
  )
}

const CONTORNO_FLECHA =
  'M623 76c5 3 10 32 17 50 129-5 232 62 278 166 69 151 9 261-112 314-98 44-220 24-280-37l-2-104c57 51 125 72 189 36 68-36 83-95 52-169-15-50-52-93-91-117l15 54-67 50-172-67c44-74 101-141 173-176'

/** El símbolo de la marca en una sola tinta (flecha + columna de la P). */
export function SimboloMarca({ tamano = 28, soloFlecha = false }: { tamano?: number; soloFlecha?: boolean }) {
  return (
    <svg
      className="pn-simbolo"
      width={tamano}
      height={tamano}
      viewBox={soloFlecha ? '330 50 780 640' : '208 50 900 900'}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={CONTORNO_FLECHA} />
      {soloFlecha ? null : <rect width="174" height="607" x="368" y="322" rx="40" ry="40" />}
    </svg>
  )
}

/** Ilustraciones de estados del sistema: todas parten del aro de la marca. */
export type Escena = 'vacio' | 'busqueda' | 'error' | 'candado' | 'mata'

export function Ilustracion({ escena }: { escena: Escena }) {
  return (
    <svg
      className="pn-ilustracion"
      data-escena={escena}
      viewBox="0 0 160 120"
      width="160"
      height="120"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse className="pn-il-suelo" cx="80" cy="106" rx="54" ry="5" />
      {escena === 'vacio' ? (
        <>
          <g className="pn-il-gira">
            <path className="pn-il-trazo" d="M80 22a38 38 0 1 1-34.7 22.5" strokeWidth="7" />
            <path className="pn-il-punta" d="M37 36l8.6 9.6 10.7-7.4" strokeWidth="7" />
          </g>
          <path className="pn-il-tallo" d="M80 98V74" strokeWidth="3" />
          <path className="pn-il-hoja" d="M80 82c-10 0-15-6-15-13 9 0 15 5 15 13Z" />
          <path className="pn-il-hoja pn-il-hoja--2" d="M80 76c8 0 13-5 13-11-8 0-13 4-13 11Z" />
        </>
      ) : null}
      {escena === 'mata' ? (
        <>
          <path className="pn-il-pista" d="M80 22a38 38 0 1 1-34.7 22.5" strokeWidth="7" strokeDasharray="1 11" />
          <path className="pn-il-tallo" d="M80 98V58" strokeWidth="3" />
          <path className="pn-il-hoja" d="M80 84c-12 0-18-7-18-15 11 0 18 6 18 15Z" />
          <path className="pn-il-hoja pn-il-hoja--2" d="M80 72c10 0 16-6 16-13-10 0-16 5-16 13Z" />
          <path className="pn-il-hoja" d="M80 62c-7 0-11-4-11-9 7 0 11 4 11 9Z" />
          <circle className="pn-il-fruto" cx="88" cy="88" r="4" />
          <circle className="pn-il-fruto" cx="94" cy="84" r="3.4" />
        </>
      ) : null}
      {escena === 'busqueda' ? (
        <>
          <path className="pn-il-pista" d="M74 22a36 36 0 1 1-33 21.6" strokeWidth="6" strokeDasharray="1 10" />
          <circle className="pn-il-trazo" cx="74" cy="58" r="20" strokeWidth="6" />
          <path className="pn-il-trazo" d="M89 73l17 17" strokeWidth="8" />
          <path className="pn-il-punta-suave" d="M66 58h16" strokeWidth="4" />
        </>
      ) : null}
      {escena === 'error' ? (
        <>
          <path className="pn-il-trazo" d="M80 22a38 38 0 0 1 36 26" strokeWidth="7" />
          <path className="pn-il-trazo" d="M117 66a38 38 0 0 1-30 31" strokeWidth="7" />
          <path className="pn-il-trazo pn-il-caido" d="M64 96a38 38 0 0 1-21-50" strokeWidth="7" />
          <path className="pn-il-chispa" d="M120 52l8-4M121 60l9 1M50 34l-6-6" strokeWidth="3" />
        </>
      ) : null}
      {escena === 'candado' ? (
        <>
          <path className="pn-il-pista" d="M80 20a40 40 0 1 1-36.6 23.6" strokeWidth="6" strokeDasharray="1 10" />
          <rect className="pn-il-cuerpo" x="60" y="56" width="40" height="32" rx="9" />
          <path className="pn-il-trazo" d="M68 56v-7a12 12 0 0 1 24 0v7" strokeWidth="6" />
          <circle className="pn-il-ojo" cx="80" cy="70" r="3.5" />
          <path className="pn-il-ojo-trazo" d="M80 72v6" strokeWidth="3" />
        </>
      ) : null}
    </svg>
  )
}
