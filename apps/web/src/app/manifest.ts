import type { MetadataRoute } from 'next'
import { CONTENIDO_SITIO } from '@/modules/contenido'

export default function manifest(): MetadataRoute.Manifest {
  const { organizacion } = CONTENIDO_SITIO
  return {
    name: organizacion.nombre,
    short_name: organizacion.nombreCorto,
    description: organizacion.descripcionCorta,
    lang: 'es-CO',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5efdc',
    theme_color: '#0b3b1e',
    icons: [
      { src: '/marca/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/marca/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/marca/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
