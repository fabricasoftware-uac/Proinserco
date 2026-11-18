---
tipo: pendientes
estado: vigente
creado: 2026-11-16
actualizado: 2026-11-18
proyecto: ProInserco
---

# Pendientes

Prioridad: **P1** bloquea el lanzamiento, **P2** antes de producción, **P3** mejora.

---

## Del cliente (Fundación Proinserco)

Fuente: `PENDIENTES_CONTENIDO` en `apps/web/src/modules/contenido/datos/contenido-sitio.ts`.

| Pri. | Pendiente | Responsable |
|---|---|---|
| P1 | NIT, razón social, registro y calificación en el Régimen Tributario Especial (RTE) | Cliente, vía Michael |
| P1 | Correo oficial (hoy `TODO-CONTENIDO`), WhatsApp y redes sociales | Cliente |
| P1 | Logo vectorial original (el actual proviene de `docs/01 - Cliente/material`) | Cliente |
| P1 | Autorización para usar los logos de los aliados y versiones en buena resolución (hay un logo de muy baja resolución) | Cliente |
| P2 | Fotos reales del equipo (buena resolución; apellidos de Sharly y Dora Stella; descripción de Luisa María) y de proyectos, para sustituir las de Pexels | Cliente |
| P2 | Completar "Impulso" en ¿Qué hacemos? | Cliente |
| P2 | Significado de la sigla "SRCTEI" | Cliente |
| P2 | Lista oficial de municipios aliados (parte viene inferida del mapa del PPTX) | Cliente |
| P2 | Montos sugeridos y destino de los fondos; si expide certificado de donación | Cliente |
| P2 | Elegir o fusionar la misión del PPTX y la del sitio Wix | Cliente |
| P1 | Cuenta de Openpay Colombia (comercio, llaves, webhook) | Cliente con Salomón |
| P2 | Fotos del equipo: ya en alta resolución (Sharly, Jorge E., Dora Stella, Luisa María); falta la de Jorge Eduardo. Validar con la fundación la descripción redactada para Luisa María | Cliente, vía Michael |

## De backend (Salomón)

Detalle en [[Handoff para Backend]] y [[Servicios Supabase para VPS]].

| Pri. | Pendiente |
|---|---|
| P1 | Respuestas de soporte de Openpay ([[Handoff para Backend]], sección 7.9) |
| P1 | Despliegue en VPS (Coolify + Supabase Self-Hosted según [[Servicios Supabase para VPS]]): aplicar migraciones con `DATABASE_URL_DIRECT`, crear usuario inicial con `scripts/alta-usuario-panel.mjs`, configurar Scheduled Task diario en `POST /api/cron/conciliacion` con `CRON_CONCILIACION_SECRETO`, cerrar origen a Cloudflare (`DESPLIEGUE=cloudflare`) y usar llaves reales de Turnstile y Openpay con `OPENPAY_SANDBOX_EN_PRODUCCION=no` |
| P1 | Pruebas en vivo en Sandbox de Openpay y VPS: flujo completo de checkout hospedado, alta del webhook `/api/webhooks/openpay/[secreto]` (`verification`, `charge.*`, `chargeback.*`), confirmar host real de checkout para `OPENPAY_CHECKOUT_ORIGIN` y validar `CSP_SOLO_REPORTE=si` → `no` |
| P2 | Ejecutar la suite de integración RLS (`apps/web/src/server/db/seguridad-rls.integration.test.ts`) y los tests de contrato contra PostgreSQL y Redis reales (`TEST_DATABASE_URL`, `TEST_REDIS_URL`) |
| P2 | Alertado y monitoreo externo sobre discrepancias/errores del cron `POST /api/cron/conciliacion` y salud del VPS |
| P2 | Correos transaccionales y certificado de donación (si el cliente confirma calificación en el RTE) |
| P2 | Rotar la clave de Pexels (`PEXELS_API_KEY` usada en `apps/web/.env.local`) |
| P3 | Funcionalidades de contrato pendientes de decisión/implementación ([[Handoff para Backend]], sección 10 puntos 3 y 7): reembolsos desde el panel (`donaciones:reembolsar`), `donantes:exportar`, `ajustes:editar` y listado multi-sesión en `IdentityProvider` |

### Completados en código (verificados hasta Fase 5)

| Ítem | Implementación verificada en el repositorio |
|---|---|
| Adaptadores reales Postgres + RLS | `repositorio-donaciones-postgres.ts`, `repositorios-postgres.ts`, `registro-auditoria-postgres.ts`, `supabase/migrations/20261118003625_*` a `20261118010625_*`, `seguridad-rls.integration.test.ts` |
| `IdentityProvider` real (Supabase Auth) | `identity-provider-supabase.ts` con MFA TOTP obligatorio (`aal2`), cookies reconciliadas con `proxy.ts`, bloqueo progresivo en `public.bloqueos_acceso`, caducidad de sesión (30 min inactividad / 8 h máx) y `scripts/alta-usuario-panel.mjs` |
| `PasarelaOpenpay` y webhook seguro | `pasarela-openpay.ts`, `/api/webhooks/openpay/[secreto]/route.ts` con `OPENPAY_WEBHOOK_SECRETO_RUTA`, Basic auth en tiempo constante, idempotencia en `public.idempotencia_webhooks`, `OPENPAY_CHECKOUT_ORIGIN` en `csp.ts` y `OPENPAY_SANDBOX_EN_PRODUCCION` en `env.ts` |
| Conciliación diaria y abandono de `creada` | `conciliar-pendientes.ts`, `POST /api/cron/conciliacion` y migración `20261118010625_permitir_expirar_donacion_creada.sql` |
| Limitador compartido con Redis | `apps/web/src/shared/infrastructure/limitador-redis.ts` cableado en `container.ts` vía `LIMITADOR_URL` |
| Retiro de archivos demo y pasarela simulada | Eliminados `demo.ts`, `acciones-demo.ts`, `usuarios-demo.ts` y rutas/acciones de `pasarela-simulada` en runtime; `supabase/seed.sql` limpio (solo queda `apps/web/src/test/pasarela-simulada.ts` en tests unitarios y `public/img/demo` pendiente de fotos reales) |
| Mejoras de contrato y tests compartidos | Puntos 1, 2, `expiraEn` del 3, 4, normalización IP `'desconocida'` → `NULL` del 5 y punto 6 de Handoff sección 10; contratos en `apps/web/src/test/contratos/*.contrato.ts` |

## Del rediseño visual

| Pri. | Pendiente | Responsable |
|---|---|---|
| P1 | Créditos de Pexels retirados del footer: confirmar si la licencia lo permite y retirar las fotos de demostración (`public/img/demo`) antes de producción | Michael |
| P3 | Excepción deliberada: el footer lleva solo «Created by Fábrica de Software», sin «Powered by EmprendeLab» (el estándar general pide ambos); pedido del usuario para este proyecto | Michael |
| P2 | Los logos de aliados se recortan con medidas fijas (`MEDIDAS` en `secciones-cierre.tsx`): volver a medir si cambian los archivos | Michael |
| P3 | Biome solo avisa (warnings): `!docs/**` en `biome.json` y varios `biome-ignore`; dependency-cruiser avisa de huérfanos: `test/server-only-vacio.ts`, `sitio/iconos.tsx`, `marca/logo-proinserco.tsx` (revisar si siguen en uso) | Michael |

## Legales

Los marcadores `[POR DEFINIR]` salen del componente `PorDefinir` (`apps/web/src/shared/ui/legal/plantilla-legal.tsx`). Responsable: fundación con su abogado/contador; Michael los traslada.

| Pri. | Dónde | Qué falta |
|---|---|---|
| P1 | Todas las páginas legales (`plantilla-legal.tsx`) | Razón social, NIT, correo para datos personales, cargo o persona responsable |
| P1 | `legal/aviso-de-privacidad` | Razón social y NIT; correo oficial |
| P1 | `legal/terminos` | Razón social y NIT; limitación de responsabilidad; fuero y jurisdicción; créditos y licencias de imágenes; correo |
| P1 | `legal/donaciones` | Destino y política de uso de fondos; medios de pago habilitados; texto del plazo y condiciones de reversión; correo |
| P1 | `legal/tratamiento-de-datos` | Normas adicionales del abogado; plazos y procedimiento de derechos del titular; encargados, países y fundamento de transferencia (hosting, Supabase, correo, etc.); plazos de conservación con el contador |
| P2 | `legal/cookies` | Duración de la sesión y del desafío MFA (la define backend); enlace a la política de cookies de Openpay |
| P2 | `app/(public)/donar/resultado/page.tsx` | Correo oficial de la fundación (un `[POR DEFINIR]` fuera de `legal`) |
| P1 | Todo | Revisión final del abogado y cambio de `versionPoliticaDatos` (hoy `borrador-2026-11-16`); validar [[ADR-0007 - Tipo y número de documento a todo donante]] |

Para listarlos todos: buscar `POR DEFINIR` en `apps/web/src`.

## Técnicos recortados por tiempo

| Pri. | Pendiente | Responsable |
|---|---|---|
| P2 | Batería E2E de Playwright (existe `apps/web/playwright.config.ts`, falta `apps/web/e2e`) | Michael |
| P2 | Escaneo de secretos (pre-commit y CI) | Michael |
| P3 | husky, lint-staged, commitlint | Michael |
| P3 | CODEOWNERS (`dto`/`ports` compartidos) y Dependabot | Michael y Salomón |
| P2 | Auditoría de accesibilidad con axe en ambos temas del panel | Michael |
| P2 | Medir Lighthouse y bundle contra [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]] | Michael |
| P3 | Reevaluar TypeScript 7 ([[ADR-0006 - TypeScript 6.0.3 y sin Turborepo]]) | Michael |
| P3 | Revisar la carpeta `.turbo` sin uso en la raíz | Michael |

### Completados en código (infraestructura y CI)

- `Dockerfile` y `.dockerignore` en la raíz del repositorio (imagen multi-stage `node:24-alpine` con `output: 'standalone'` y `HEALTHCHECK` en `/api/health`).
- CI/CD con GitHub Actions en `.github/workflows/ci.yml`: ejecuta `pnpm verify` en `push`/`pull_request` a `main` y construye/publica la imagen Docker en GHCR en `push` a `main`.

---

## Enlaces

[[ProInserco]] · [[Handoff para Backend]] · [[Checklist de Seguridad para Producción]] · [[Contenido fuente]]
