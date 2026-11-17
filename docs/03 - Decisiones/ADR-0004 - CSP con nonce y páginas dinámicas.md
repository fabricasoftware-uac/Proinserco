---
tipo: adr
numero: 0004
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0004 - CSP con nonce en todo el sitio, páginas HTML dinámicas

## Estado

Aceptada, 2026-11-16.

## Contexto

El estándar ([[Cabeceras y CSP]]) exige una CSP estricta sin `'unsafe-inline'` en scripts. Next.js inyecta scripts en línea (hidratación, datos de la página) y solo puede autorizarlos con un **nonce**. Un nonce vale para **una sola respuesta**: se genera por petición en `apps/web/src/proxy.ts` (`generarNonce()`, 128 bits) y la política se construye en `apps/web/src/server/csp.ts` (`construirCsp`). Next lee el nonce de la cabecera de la petición y lo escribe en el HTML.

Consecuencia directa: el HTML contiene un valor distinto en cada petición. Por eso **ninguna página que lleve scripts de Next puede ser estática ni cacheable como HTML**. Todas las páginas se renderizan por petición (`force-dynamic`, ver `apps/web/src/app/(public)/layout.tsx`, que explica además por qué).

## Decisión

> Usaremos CSP con nonce en todo el sitio (público, acceso y panel) y aceptaremos que el HTML sea dinámico. Recuperamos rendimiento con caché de activos, páginas públicas sin consultas a datos y presupuesto de rendimiento (ver ADR-0005), no cacheando el HTML.

Política vigente (`construirCsp`): `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'` + host de Turnstile (`'unsafe-eval'` solo en desarrollo); `style-src 'self' 'unsafe-inline'` (riesgo aceptado: next/font, Tailwind y GSAP escriben `style` en línea); `img-src 'self' blob: data:`; `frame-src` solo Turnstile; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` en HTTPS.

## Por qué NO se puede cachear HTML con nonce en el borde

Si Cloudflare guarda una respuesta HTML y la sirve a otros visitantes, pasan dos cosas, ambas malas:

1. **El nonce del HTML cacheado deja de coincidir con la cabecera `Content-Security-Policy`.** Si la cabecera también viene del caché, todos los visitantes comparten el mismo nonce: un nonce reutilizable y conocido anula la protección (cualquier script inyectado podría llevarlo). Si la cabecera se vuelve a generar en el origen pero el HTML sale del caché, el nonce del HTML no coincide con el de la cabecera y el navegador **bloquea todo el JavaScript**: el sitio queda muerto.
2. Las respuestas dinámicas llevan `Set-Cookie` o dependen de cookies (`/panel`, `/acceso`); cachearlas puede servir una sesión ajena. Por eso las rutas del panel son además `no-store`.

Regla práctica: en Cloudflare, **"Cache Everything" no se activa para HTML**. Se deja el comportamiento por defecto (el HTML no se cachea) y se cachean solo los estáticos.

## Cómo se recupera rendimiento

| Medida | Dónde | Detalle |
|---|---|---|
| Caché larga de estáticos | Cloudflare (regla de caché) | `/_next/static/*`, `/img/*`, `/marca/*` y fuentes: son inmutables o versionados. Respetar sus `Cache-Control` |
| Páginas públicas sin consultas a datos | Código | El contenido sale de `modules/contenido` (estático tipado); la página principal no toca base de datos |
| Imágenes optimizadas | `next.config.ts` | AVIF/WebP, `minimumCacheTTL` de 31 días, calidades 60/75/85 |
| Compresión y HTTP/3 | Cloudflare | Activados por defecto |
| Auditoría antes del lanzamiento | Lighthouse | Medir con `next build` + `next start`, no con `next dev` |
| Si el HTML dinámico llegara a ser un cuello de botella | Alternativa futura | CSP basada en hashes para páginas verdaderamente estáticas (requiere ADR nueva); no se hace ahora |

## Alternativas consideradas

### Alternativa A - CSP con `'unsafe-inline'` en `script-src`
- Ventaja: permite páginas estáticas y caché de HTML.
- Contra: anula la defensa principal contra XSS.
- **Descartada porque**: el estándar la prohíbe.

### Alternativa B - CSP con hashes (sin nonce)
- Ventaja: HTML cacheable.
- Contra: Next genera scripts en línea con contenido variable; mantener los hashes es frágil.
- **Descartada porque**: frágil y fuera del soporte habitual de Next.

### Alternativa C - Nonce por petición (elegida)
- **Elegida**: coste de rendimiento aceptado y compensado.

## Consecuencias

**Positivas**
- Sin `'unsafe-inline'` en scripts; XSS reflejado queda muy acotado.

**Negativas**
- Cada vista de página renderiza en el servidor; más CPU en el VPS y TTFB mayor que con HTML estático.
- No se puede usar "Cache Everything" ni Always Online sobre HTML.
- Cualquier tercero nuevo (por ejemplo, el host del checkout de Openpay en `form-action`) exige editar `csp.ts`.

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Alguien activa caché de HTML en Cloudflare y se rompe el JS | Media | Alto | Está documentado aquí y en el checklist de producción; verificar con `curl -I` que el HTML no trae `cf-cache-status: HIT` |
| Rocket Loader inyecta scripts sin nonce | Media | Alto | Apagado (ver ADR-0003) |
| Añadir hosts a la CSP sin probar rompe el pago | Media | Alto | Pasar a producción con `CSP_SOLO_REPORTE=si` primero |

## Cómo se revierte

Cambiar a hashes o relajar la política implica una nueva ADR. El coste técnico es bajo (solo `csp.ts` y `proxy.ts`), pero reduce la seguridad.

## Enlaces

- [[Cabeceras y CSP]] · [[Renderizado y Caché]] (vault general)
- [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]]
- [[Checklist de Seguridad para Producción]]
- [[ProInserco]]
