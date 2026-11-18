---
tipo: adr
numero: 0003
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-18
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare

## Estado

Aceptada, 2026-11-16.

## Contexto

El estándar del vault prefiere Vercel. Aquí el equipo ya dispone de un VPS en DigitalOcean con Coolify y el dominio está en Cloudflare. Salomón opera el despliegue. El proyecto ya está preparado para ello: `output: 'standalone'` en `apps/web/next.config.ts`, `Dockerfile` y `.dockerignore` en la raíz, flujo de CI/CD en `.github/workflows/ci.yml`, endpoint `/api/health` para el chequeo de Coolify, endpoint `/api/cron/conciliacion` para la conciliación diaria y la variable `DESPLIEGUE` para resolver la IP del cliente.

## Decisión

> Desplegaremos la imagen Docker de la app en el VPS de DigitalOcean con Coolify, con Cloudflare delante (proxy activo, SSL Full strict), siguiendo [[Despliegue en VPS con Coolify]] y [[Servicios Supabase para VPS]].

Reglas que se heredan del vault y no se negocian:
- **El VPS no construye.** El `next build` corre en GitHub Actions (`.github/workflows/ci.yml` construye la imagen con `Dockerfile` y `.dockerignore` tras pasar `pnpm verify` y la publica en GHCR); Coolify solo descarga la imagen de GHCR y reinicia.
- **Rocket Loader apagado** en Cloudflare: rompe los scripts con nonce de la CSP.
- **El origen solo acepta tráfico de Cloudflare** (firewall con los rangos de Cloudflare, o Cloudflare Tunnel). Solo así es fiable `CF-Connecting-IP` y, por tanto, el limitador de tasa por IP.
- Con ese origen cerrado, `DESPLIEGUE=cloudflare`. Mientras no, `DESPLIEGUE=directo` (usa `X-Real-IP` de Traefik).
- **Openpay en producción nunca usa sandbox por accidente.** Con `NODE_ENV=production` y `ADAPTADORES=real`, `apps/web/src/server/env.ts` exige `OPENPAY_API_URL=https://api.openpay.co` y `OPENPAY_SANDBOX_EN_PRODUCCION=no` (valor por defecto en `.env.example`). Solo puede fijarse `OPENPAY_SANDBOX_EN_PRODUCCION=si` de forma temporal en staging o pruebas sandbox bajo `NODE_ENV=production` en Coolify/VPS, debiendo volver a `"no"` antes de operar con llaves reales de producción.
- **Conciliación diaria mediante cron en Coolify.** El VPS ejecuta un Scheduled Task diario contra `POST /api/cron/conciliacion` (`apps/web/src/app/api/cron/conciliacion/route.ts`) autenticado con `Authorization: Bearer <CRON_CONCILIACION_SECRETO>` (validado en tiempo constante; obligatorio con `ADAPTADORES=real`).

## Alternativas consideradas

### Alternativa A - Vercel
- Ventaja: DDoS básico, despliegue sin operar infraestructura, `ipAddress()`.
- Contra: el equipo ya tiene VPS y dominio en Cloudflare; coste adicional y datos en otra plataforma.
- **Descartada porque**: duplica infraestructura que ya existe.

### Alternativa B - VPS con Coolify detrás de Cloudflare
- Ventaja: infraestructura propia ya pagada; Cloudflare aporta mitigación DDoS y Turnstile gratis.
- Contra: lo opera una persona; sin protección del origen, Cloudflare no sirve de nada; el VPS es un punto único de fallo.
- **Elegida**.

## Consecuencias

**Positivas**
- Un solo lugar de operación; Cloudflare gratuito cubre DDoS básico, WAF y Turnstile.
- El repositorio ya incluye `Dockerfile`, `.dockerignore`, pipeline de CI en `.github/workflows/ci.yml` (`pnpm verify` + publicación en GHCR), `POST /api/cron/conciliacion` para conciliación diaria y `apps/web/src/shared/infrastructure/limitador-redis.ts` para escalado multi-réplica.

**Negativas**
- Salomón es responsable de parches del servidor, firewall, backups, monitoreo y del Scheduled Task diario en Coolify.
- Si Coolify o el VPS caen, cae el sitio (no hay réplica).
- Con varias instancias, el limitador de tasa en memoria deja de ser válido y debe activarse Redis definiendo `LIMITADOR_URL` en Coolify (el adaptador `apps/web/src/shared/infrastructure/limitador-redis.ts` ya está implementado y cableado en `apps/web/src/server/container.ts`).

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| IP del origen expuesta, ataque directo | Media | Alto | Firewall solo-Cloudflare o Tunnel; `curl -k https://<IP-origen>` debe fallar |
| `CF-Connecting-IP` falsificable si el origen está abierto | Media | Alto (se anula el límite por IP) | No poner `DESPLIEGUE=cloudflare` hasta cerrar el origen |
| Compilar en el VPS tumba todos los sitios del servidor | Media | Alto | Build en CI, imagen en GHCR |

## Cómo se revierte

Mover a otro hosting exige solo cambiar variables de entorno y `DESPLIEGUE`; la app es una imagen Docker estándar. Coste bajo.

## Enlaces

- [[Despliegue en VPS con Coolify]] · [[Protección contra DDoS, Bots y Abuso]] (vault general)
- [[Checklist de Seguridad para Producción]]
- [[Handoff para Backend]]
- [[Servicios Supabase para VPS]]
- [[ProInserco]]
