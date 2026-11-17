import type { ReactNode } from 'react'

type Props = { children: ReactNode }

/** Texto visible solo para lectores de pantalla (p. ej. el <caption> de una tabla). */
export function SoloLectores({ children }: Props) {
  return <span className="sr-only">{children}</span>
}
