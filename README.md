# Fundación Proinserco — sitio y panel

Monorepo pnpm: `apps/web` (Next.js 16, App Router) + `packages/{tokens,ui,config}`.
Documento rector: `docs/02 - Diseño/Especificación del sitio.md`.

Documentación: `docs/ProInserco.md` (índice). Para backend y despliegue: `docs/05 - Backend/Handoff para Backend.md` y `docs/05 - Backend/Servicios Supabase para VPS.md`.

## Arrancar

```bash
# Node 24 (.nvmrc) y pnpm 12.21.0 (packageManager). Con corepack: `corepack pnpm …`
pnpm install
cp .env.example apps/web/.env.local   # y rellenar SESION_SECRETO (≥ 32 caracteres)
pnpm dev                              # http://localhost:3000
```

Producción local: `pnpm build` y `node apps/web/.next/standalone/apps/web/server.js`
(con `ADAPTADORES=memoria` en producción hay que añadir `ADAPTADORES_MEMORIA_EN_PRODUCCION=si`).

## Scripts

| Script                                | Qué hace                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm verify`                         | typecheck + lint + depcruise + test + build (lo que bloquea un merge)               |
| `pnpm lint`                           | Biome + comprobación de tokens primitivos fuera de `packages/tokens`                |
| `pnpm depcruise` / `depcruise:grafo`  | Reglas de capas (y tamaño del grafo: no debe estar vacío)                           |
| `pnpm --filter @proinserco/web marca` | Regenera logo, iconos, fotos de equipo y aliados desde `docs/01 - Cliente/material` |
| `pnpm imagenes:pexels`                | Fotos demo de Pexels (clave en `apps/web/.env.local`)                               |

## Estructura

- `apps/web/src/app` — rutas `(public)`, `(auth)`, `(app)` y `api/` (`/api/health`, `/api/webhooks/openpay/[secreto]`, `/api/cron/conciliacion`).
- `apps/web/src/modules/{donaciones,donantes,iam,auditoria,contenido}` — negocio hexagonal (`domain` → `application` → `infrastructure` / `ui`).
- `apps/web/src/flujos/donar` — flujo que cruza donaciones + donantes (esquema + server action).
- `apps/web/src/server` — composition root (`container.ts`), `env.ts`, `db/` (Drizzle ORM + contexto RLS), `auth-context.ts`, `acciones.ts`, CSP.
- `apps/web/src/shared` — dominio transversal, puertos transversales, adaptadores compartidos (`limitador-redis.ts`, `verificador-turnstile.ts`), fuentes, tema.
- `supabase/` y `scripts/alta-usuario-panel.mjs` — migraciones SQL (PostgreSQL 17, RLS `ENABLE` + `FORCE`, `custom_access_token_hook`) y alta administrativa de usuarios del panel.
- `ADAPTADORES=memoria|real` en `apps/web/src/server/container.ts` elige los adaptadores:
  - `memoria`: repositorios e identidad en memoria sin persistencia ni pasarela (solo pruebas locales; la pasarela simulada fue retirada).
  - `real`: PostgreSQL / Supabase vía Drizzle ORM (`DATABASE_URL` por Supavisor y RLS), Supabase Auth con MFA TOTP obligatorio (`@supabase/ssr`, solo servidor), Openpay Colombia (checkout hospedado por redirección, webhook en `/api/webhooks/openpay/[secreto]` y cron `/api/cron/conciliacion`), Cloudflare Turnstile y limitador compartido opcional en Redis (`LIMITADOR_URL` con `apps/web/src/shared/infrastructure/limitador-redis.ts`).
- Despliegue y CI: `Dockerfile` y `.dockerignore` (imagen `node:24-alpine` con `output: 'standalone'` y `HEALTHCHECK` en `/api/health`) y `.github/workflows/ci.yml` (`pnpm verify` en PR/push a `main` y publicación de imagen Docker en GHCR en `main`).

Variables: ver `.env.example` (todas documentadas).

## Nota para ADR: CSP con nonce y rendimiento del sitio público

Todas las páginas HTML son dinámicas (`force-dynamic`) para que el nonce de la CSP coincida con el HTML
(vault: Cabeceras y CSP, opción 1). Sin `'unsafe-inline'` en scripts. Compensación: caché larga en Cloudflare
de `/_next/static`, `/img`, `/marca`; páginas públicas sin consultas a datos; revisar Lighthouse antes del lanzamiento.
