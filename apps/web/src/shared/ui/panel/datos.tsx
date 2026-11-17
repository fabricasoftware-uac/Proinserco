import type { Tono } from './aro'
import {
  formatearFechaCompleta,
  formatearRelativo,
  nombreMes,
  type PartesFecha,
  partesDia,
  partesFecha,
  partesPesos,
} from './formato'

/*
 * Cada dato del panel tiene un componente diseñado: nada de fechas ni montos
 * como texto plano. Son componentes de servidor puros (sin hooks): también se
 * pueden usar dentro de componentes cliente.
 */

type VarianteFecha = 'tabla' | 'ficha' | 'linea' | 'relativa' | 'dia' | 'titular'

type PropsFecha = {
  /** Instante ISO (se muestra en hora de Colombia). */
  iso?: string | undefined
  /** O un día de calendario AAAA-MM-DD (sin hora). */
  dia?: string | undefined
  variante?: VarianteFecha
  /** Color de la pestaña del bloque (por estado). Sin tono: verde de la marca. */
  tono?: Tono | undefined
  /** Para `relativa`: el "ahora" de quien renderiza (servidor). */
  ahora?: Date | undefined
  /** Ocultar la hora aunque haya instante. */
  sinHora?: boolean
}

const ANIO_ACTUAL = () => new Date().getFullYear()

function textoAccesible(p: PartesFecha, iso: string | undefined, sinHora: boolean) {
  if (iso && !sinHora) return formatearFechaCompleta(iso)
  return `${p.diaSemana}, ${p.dia} de ${nombreMes(p.mes0)} de ${p.anio}`
}

/** Fecha con diseño propio. Siempre lleva <time dateTime> y el texto completo para lectores. */
export function Fecha({ iso, dia, variante = 'tabla', tono, ahora, sinHora = false }: PropsFecha) {
  const p = iso ? partesFecha(iso) : partesDia(dia ?? '1970-01-01')
  const dateTime = iso ?? dia ?? ''
  const completo = textoAccesible(p, iso, sinHora)
  const conHora = Boolean(iso) && !sinHora

  if (variante === 'relativa' && iso) {
    return (
      <time className="pn-fecha-rel" dateTime={dateTime} title={completo}>
        <span aria-hidden="true">{formatearRelativo(iso, ahora ?? new Date())}</span>
        <span className="pn-solo-lectores">{completo}</span>
      </time>
    )
  }

  if (variante === 'dia' || variante === 'linea') {
    return (
      <time className={`pn-fecha-${variante}`} dateTime={dateTime} title={completo}>
        <span aria-hidden="true">
          <b>{p.dia}</b>
          <span className="pn-fecha-mes">{p.mes}</span>
          {variante === 'dia' || p.anio !== ANIO_ACTUAL() ? <span className="pn-fecha-anio">{p.anio}</span> : null}
          {variante === 'linea' && conHora ? <span className="pn-fecha-hora">{p.hora}</span> : null}
        </span>
        <span className="pn-solo-lectores">{completo}</span>
      </time>
    )
  }

  if (variante === 'titular') {
    return (
      <time className="pn-fecha-titular" dateTime={dateTime}>
        <span className="pn-fecha-titular-dia" aria-hidden="true">
          {p.dia}
        </span>
        <span className="pn-fecha-titular-resto" aria-hidden="true">
          <span>{p.diaSemana}</span>
          <span>
            {nombreMes(p.mes0)} {p.anio}
          </span>
        </span>
        <span className="pn-solo-lectores">{completo}</span>
      </time>
    )
  }

  // Bloque tipo pestaña de calendario: tabla y ficha.
  return (
    <time
      className={`pn-fecha-bloque pn-fecha-bloque--${variante}${tono ? ` pn-tono-${tono}` : ''}`}
      dateTime={dateTime}
      title={completo}
    >
      <span className="pn-fecha-hoja" aria-hidden="true">
        <span className="pn-fecha-hoja-dia">{p.dia}</span>
        <span className="pn-fecha-hoja-mes">{p.mes}</span>
        <span className="pn-fecha-hoja-anio">{p.anio}</span>
      </span>
      {conHora || variante === 'ficha' ? (
        <span className="pn-fecha-lado" aria-hidden="true">
          <span className="pn-fecha-semana">{p.diaSemana}</span>
          {conHora ? <span className="pn-fecha-hora">{p.hora}</span> : null}
        </span>
      ) : null}
      <span className="pn-solo-lectores">{completo}</span>
    </time>
  )
}

type TamanoMonto = 'tabla' | 'medio' | 'grande' | 'heroe'

/** Monto en pesos: cifra tabular de la marca, símbolo y código atenuados. */
export function Monto({
  pesos,
  tamano = 'tabla',
  codigo = false,
}: {
  pesos: number
  tamano?: TamanoMonto
  /** Mostrar "COP" detrás de la cifra. */
  codigo?: boolean
}) {
  const { signo, cifra } = partesPesos(pesos)
  // Separa el último grupo de miles para atenuarlo levemente en las cifras grandes.
  const corte = tamano === 'heroe' || tamano === 'grande' ? cifra.lastIndexOf('.') : -1
  return (
    <span className={`pn-monto pn-monto--${tamano}`}>
      <span className="pn-monto-simbolo">{signo}$</span>
      {corte > 0 ? (
        <span className="pn-monto-cifra">
          {cifra.slice(0, corte)}
          <span className="pn-monto-miles">{cifra.slice(corte)}</span>
        </span>
      ) : (
        <span className="pn-monto-cifra">{cifra}</span>
      )}
      {codigo ? <span className="pn-monto-codigo">COP</span> : null}
    </span>
  )
}

/** Dato enmascarado: los "•" se dibujan como una fila de puntos y se anuncia "oculto". */
export function DatoEnmascarado({ valor, revelado = false }: { valor: string; revelado?: boolean }) {
  if (revelado) return <span className="pn-dato pn-dato--revelado">{valor}</span>
  const trozos = valor.split(/(•+)/).filter(Boolean)
  return (
    <span className="pn-dato">
      {trozos.map((t, i) =>
        t.startsWith('•') ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: trozos estáticos de un mismo valor
          <span key={i} className="pn-mascara" aria-hidden="true">
            {Array.from({ length: Math.min(t.length, 6) }, (_, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: puntos decorativos
              <i key={j} />
            ))}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: trozos estáticos de un mismo valor
          <span key={i}>{t}</span>
        ),
      )}
      <span className="pn-solo-lectores"> (parcialmente oculto)</span>
    </span>
  )
}
