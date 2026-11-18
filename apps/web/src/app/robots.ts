import type { MetadataRoute } from 'next'

/** El panel, el acceso, la API y el resultado de donación no se indexan (además llevan noindex). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/panel', '/acceso', '/api/', '/donar/resultado'] }],
  }
}
