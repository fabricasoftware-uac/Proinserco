import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import './globals.css'

const { organizacion } = CONTENIDO_SITIO

// Todas las páginas HTML llevan CSP con nonce por petición: nada se prerenderiza
// en el build (incluida la 404), o su nonce no coincidiría con la cabecera.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: { default: `${organizacion.nombre} · ${organizacion.lema}`, template: `%s · ${organizacion.nombreCorto}` },
  description: organizacion.descripcionCorta,
  applicationName: organizacion.nombre,
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5efdc',
}

/**
 * Raíz común mínima. Cada grupo de rutas pone su zona (data-zona), sus
 * fuentes, su tema y su estrategia de renderizado en su propio layout.
 * `suppressHydrationWarning`: el script de tema escribe data-tema en <html>.
 */
export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
