import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

/**
 * Cabeceras de seguridad comunes (vault: Cabeceras y CSP). La CSP con nonce
 * la pone src/proxy.ts porque cambia en cada petición.
 * HSTS sin `preload`: se activa solo cuando el dominio definitivo y TODOS sus
 * subdominios sirvan HTTPS (salir de la lista de precarga tarda meses).
 */
const cabecerasSeguridad = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const raizMonorepo = fileURLToPath(new URL('../../', import.meta.url))

const configuracion: NextConfig = {
  output: 'standalone',
  // fileURLToPath y NUNCA `.pathname`: en Windows rompe Turbopack (Gotchas Verificados).
  outputFileTracingRoot: raizMonorepo,
  turbopack: { root: raizMonorepo },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  transpilePackages: ['@proinserco/ui', '@proinserco/tokens'],
  images: {
    formats: ['image/avif', 'image/webp'],
    // Cada calidad distinta es una variante en caché: elegir SIEMPRE de esta lista.
    qualities: [60, 75, 85],
    deviceSizes: [480, 640, 828, 1080, 1280, 1600, 1920, 2560],
    // Los SVG se sirven como archivos estáticos, nunca por el optimizador (RCE sharp/librsvg 2026).
    dangerouslyAllowSVG: false,
    remotePatterns: [],
    minimumCacheTTL: 2_678_400,
  },
  experimental: {
    // Los formularios no suben archivos: el límite de 1 MB por defecto se baja.
    serverActions: { bodySizeLimit: '64kb' },
  },
  async headers() {
    return [
      { source: '/:path*', headers: cabecerasSeguridad },
      {
        source: '/panel/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default configuracion
