import { formatearNumero } from '@/shared/ui/panel/formato'

export type TipoCambio = 'porcentaje' | 'puntos'
type Sentido = 'sube' | 'baja' | 'igual'

export function cambio(actual: number, previo: number, tipo: TipoCambio): { texto: string; sentido: Sentido } {
  if (tipo === 'puntos') {
    const puntos = (actual - previo) * 100
    return {
      texto: `${puntos > 0 ? '+' : ''}${puntos.toFixed(1).replace('.', ',')} pts`,
      sentido: Math.abs(puntos) < 0.05 ? 'igual' : puntos > 0 ? 'sube' : 'baja',
    }
  }
  if (previo === 0) return actual === 0 ? { texto: 'Sin cambio', sentido: 'igual' } : { texto: 'Nuevo', sentido: 'sube' }
  const pct = ((actual - previo) / previo) * 100
  if (Math.abs(pct) < 0.05) return { texto: '0 %', sentido: 'igual' }
  return { texto: `${pct > 0 ? '+' : ''}${formatearNumero(Math.round(pct * 10) / 10)} %`, sentido: pct > 0 ? 'sube' : 'baja' }
}

const TONO: Readonly<Record<Sentido, string>> = { sube: 'pn-tono-ok', baja: 'pn-tono-malo', igual: 'pn-tono-neutro' }

/** La flecha de la marca (arco que vuelve) apuntando hacia arriba, abajo o en reposo. */
function FlechaMarca({ sentido }: { sentido: Sentido }) {
  if (sentido === 'igual') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={sentido === 'baja' ? { transform: 'rotate(90deg)' } : undefined}
    >
      <path d="M3 13Q3.6 5 12 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M8.6 1.9 12 4.2 9.4 7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Variación frente al periodo anterior: flecha de marca + cifra, sin píldora. */
export function Variacion({
  actual,
  previo,
  tipo = 'porcentaje',
  nota,
}: {
  actual: number
  previo: number
  tipo?: TipoCambio
  nota?: string
}) {
  const c = cambio(actual, previo, tipo)
  return (
    <span className={`pn-variacion ${TONO[c.sentido]}`}>
      <FlechaMarca sentido={c.sentido} />
      {c.texto}
      <span className="pn-solo-lectores"> frente al periodo anterior</span>
      {nota ? <span className="pn-variacion-nota">{nota}</span> : null}
    </span>
  )
}
