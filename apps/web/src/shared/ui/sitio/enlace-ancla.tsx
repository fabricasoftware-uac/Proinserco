'use client'

import type { ComponentProps } from 'react'
import { irAAncla } from './movimiento'

type Props = Omit<ComponentProps<'a'>, 'href'> & { ancla: string }

/** Enlace a una sección de la misma página con desplazamiento suave y foco en el destino. */
export function EnlaceAncla({ ancla, onClick, ...resto }: Props) {
  return (
    <a
      href={`#${ancla}`}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (irAAncla(ancla)) e.preventDefault()
      }}
      {...resto}
    />
  )
}
