import type { SVGProps } from 'react'

/**
 * La flecha circular del logo: el hilo del mundo "dar la vuelta".
 * Sin ids (se repite muchas veces por página) y siempre decorativa.
 *
 * - FlechaTrazo: versión de TRAZO (aro + punta) para dibujarla con DrawSVG,
 *   recorrerla con una chispa o hacerla girar. viewBox 0 0 100 100, centro
 *   (50,50), radio 34. El aro sale abajo a la izquierda y gira en sentido
 *   antihorario hasta la punta, arriba a la izquierda, que apunta hacia
 *   abajo (como en el logo).
 * - FlechaMarca: la silueta REAL del logo (contorno-flecha) rellena con
 *   currentColor, para usos grandes (menú, footer, sellos).
 */
export const ARO_D = 'M18.05 61.63 A34 34 0 1 0 20.56 33'
export const PUNTA_D = 'M16.06 40.8 L30.2 36.3 L13.2 26.2 Z'

type PropsTrazo = SVGProps<SVGSVGElement> & { grosor?: number; conPunta?: boolean }

export function FlechaTrazo({ grosor = 9, conPunta = true, className, ...resto }: PropsTrazo) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false" className={className} {...resto}>
      <path data-flecha-aro="" d={ARO_D} stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" />
      {conPunta ? (
        <path
          data-flecha-punta=""
          d={PUNTA_D}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={grosor * 0.35}
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}

/** Silueta del logo (sin la P). viewBox recortado al aro. */
export const CONTORNO_FLECHA_D =
  'M623 76c5 3 10 32 17 50 129-5 232 62 278 166 69 151 9 261-112 314-98 44-220 24-280-37l-2-104c57 51 125 72 189 36 68-36 83-95 52-169-15-50-52-93-91-117l15 54-67 50-172-67c44-74 101-141 173-176'

export function FlechaMarca({ className, ...resto }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="430 60 560 580" aria-hidden="true" focusable="false" className={className} {...resto}>
      <path d={CONTORNO_FLECHA_D} fill="currentColor" />
    </svg>
  )
}
