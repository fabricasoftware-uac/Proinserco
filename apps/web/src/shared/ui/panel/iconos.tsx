import type { ReactNode } from 'react'

/**
 * Iconos propios del panel: trazo de 1.7 en rejilla de 24, extremos redondeados.
 * Los de navegación comparten el motivo de la marca (el aro que vuelve, la semilla,
 * el registro con su aro). Decorativos: aria-hidden; el contenedor pone el nombre.
 */
const TRAZOS = {
  resumen: (
    <>
      <path d="M7.5 19.5v-4.5M12 19.5v-8M16.5 19.5V14" />
      <path d="M4.2 11.2A8.2 8.2 0 0 1 18.6 6.4" />
      <path d="M18.9 3.2l-.2 3.5-3.4-.4" />
    </>
  ),
  donaciones: (
    <>
      <path d="M12 20.2c-4.4 0-7.4-3.1-7.4-7.4 0-4.7 4.3-8.5 7.4-9.4 3.1.9 7.4 4.7 7.4 9.4 0 4.3-3 7.4-7.4 7.4Z" />
      <path d="M12 20.2v-8.4M12 15.4l-2.6-2.4M12 13.2l2.4-2.2" />
    </>
  ),
  donantes: (
    <>
      <circle cx="9" cy="8.6" r="3.4" />
      <path d="M2.9 19.8c.5-3.3 3-5.3 6.1-5.3s5.6 2 6.1 5.3" />
      <path d="M15.6 5.4a3.3 3.3 0 0 1 0 6.3M17.8 14.7c1.9.7 3 2.3 3.3 4.6" />
    </>
  ),
  auditoria: (
    <>
      <path d="M14.5 20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h8.2a2 2 0 0 1 2 2V10" />
      <path d="M8.5 8h5.5M8.5 11.5h3.5" />
      <circle cx="16.6" cy="16.4" r="3.3" />
      <path d="m15.2 16.5 1 1 1.9-2" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h8.6M17.4 7H20M4 17h2.6M11.4 17H20" />
      <circle cx="15" cy="7" r="2.4" />
      <circle cx="9" cy="17" r="2.4" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  menu: <path d="M4 8h16M4 16h10" />,
  cerrar: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  'chevron-izq': <path d="m14.5 6-6 6 6 6" />,
  'chevron-der': <path d="m9.5 6 6 6-6 6" />,
  'chevron-abajo': <path d="m6 9.5 6 6 6-6" />,
  descargar: (
    <>
      <path d="M12 4v10.5M7.8 10.6 12 14.8l4.2-4.2" />
      <path d="M5 19.5h14" />
    </>
  ),
  copiar: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.6" />
      <path d="M15.5 8.5V6.6a2.1 2.1 0 0 0-2.1-2.1H6.6a2.1 2.1 0 0 0-2.1 2.1v6.8a2.1 2.1 0 0 0 2.1 2.1h1.9" />
    </>
  ),
  calendario: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
      <circle cx="12" cy="15" r="1.4" />
    </>
  ),
  ojo: (
    <>
      <path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  'ojo-cerrado': (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.9 6.1c.7-.2 1.4-.3 2.1-.3 6 0 9.2 6.2 9.2 6.2a15 15 0 0 1-2.6 3.3M6.6 7.7A15.3 15.3 0 0 0 2.8 12S6 18.2 12 18.2c1.5 0 2.8-.4 4-.9" />
      <path d="M10.2 10.2a2.8 2.8 0 0 0 3.6 3.6" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  escudo: <path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6l-7-2.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alerta: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.2M12 16.3v.1" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  luna: <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />,
  sistema: (
    <>
      <rect x="3.5" y="4.5" width="17" height="12" rx="2.5" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  salir: (
    <>
      <path d="M14 4.5H7.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" />
      <path d="M10 12h10.5M17 8.5 20.5 12 17 15.5" />
    </>
  ),
  'flecha-der': <path d="M5 12h14M13 6l6 6-6 6" />,
  'flecha-izq': <path d="M19 12H5M11 6l-6 6 6 6" />,
  filtro: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  'orden-asc': <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />,
  'orden-desc': <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />,
  'orden-ambos': <path d="M8 9.5 12 5.5l4 4M8 14.5l4 4 4-4" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  llave: (
    <>
      <circle cx="8" cy="15" r="3.8" />
      <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M13.5 9.5l2 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  enter: <path d="M19 5v6a3 3 0 0 1-3 3H6M9.5 10.5 6 14l3.5 3.5" />,
} satisfies Record<string, ReactNode>

export type NombreIcono = keyof typeof TRAZOS

type Props = { nombre: NombreIcono; tamano?: number; className?: string }

export function Icono({ nombre, tamano = 20, className }: Props) {
  return (
    <svg
      className={className ? `pn-icono ${className}` : 'pn-icono'}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
