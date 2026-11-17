---
tipo: adr
numero: 0003
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare

## Estado

Aceptada, 2026-11-16.

## Contexto

El estándar del vault prefiere Vercel. Aquí el equipo ya dispone de un VPS en DigitalOcean con Coolify y el dominio está en Cloudflare. Salomón opera el despliegue. El proyecto ya está preparado para ello: `output: 'standalone'` en `apps/web/next.config.ts`, endpoint `/api/health` para el chequeo de Coolify y la variable `DESPLIEGUE` para resolver la IP del cliente.

## Decisión

> Desplegaremos la imagen Docker de la app en el VPS de DigitalOcean con Coolify, con Cloudflare delante (proxy activo, SSL Full strict), siguiendo [[Despliegue en VPS con Coolify]].

Reglas que se heredan del vault y no se negocian:
- **El VPS no construye.** El `next build` corre en CI; Coolify solo descarga la imagen de GHCR y reinicia.
- **Rocket Loader apagado** en Cloudflare: rompe los scripts con nonce de la CSP.
- **El origen solo acepta tráfico de Cloudflare** (firewall con los rangos de Cloudflare, o Cloudflare Tunnel). Solo así es fiable `CF-Connecting-IP` y, por tanto, el limitador de tasa por IP.
- Con ese origen cerrado, `DESPLIEGUE=cloudflare`. Mientras no, `DESPLIEGUE=directo` (usa `X-Real-IP` de Traefik).

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

**Negativas**
- Salomón es responsable de parches del servidor, firewall, backups y monitoreo.
- Si Coolify o el VPS caen, cae el sitio (no hay réplica).
- Con varias instancias, el limitador de tasa en memoria deja de ser válido: hay que implementar `limitador-redis.ts`.
- No existe Dockerfile ni CI en el repositorio hoy (ver Pendientes): hay que crearlos antes del primer despliegue.

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
- [[ProInserco]]
