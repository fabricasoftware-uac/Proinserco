---
tipo: pendientes
estado: vigente
creado: 2026-11-16
actualizado: 2026-11-17
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

Detalle en [[Handoff para Backend]].

| Pri. | Pendiente |
|---|---|
| P1 | Adaptadores reales: donaciones, donantes, consentimientos, auditoría (Drizzle + Supabase Postgres, RLS) |
| P1 | `IdentityProvider` de Supabase con MFA TOTP, bloqueo progresivo y timeout por inactividad |
| P1 | `PasarelaOpenpay` y webhook completo (secreto en la ruta, cola o respuesta rápida) |
| P1 | Respuestas de soporte de Openpay (Handoff 7.9) |
| P1 | Eliminar datos y secretos de demostración |
| P1 | Despliegue: Dockerfile, CI, Coolify, Cloudflare con origen cerrado |
| P2 | Conciliación diaria y política para donaciones `creada` abandonadas |
| P2 | Limitador con Redis |
| P2 | Mejoras de contrato (Handoff sección 10, puntos 1 a 7) |
| P2 | Tests de contrato compartidos memoria/real |
| P2 | Correos transaccionales y certificado de donación (si el cliente está en el RTE) |
| P2 | Rotar la clave de Pexels |
| P3 | Reembolsos desde el panel (`donaciones:reembolsar` existe sin funcionalidad) |

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
| P2 | CI con GitHub Actions (`pnpm verify`) y construcción de imagen | Salomón |
| P2 | Dockerfile y `.dockerignore` | Salomón |
| P2 | Escaneo de secretos (pre-commit y CI) | Michael |
| P3 | husky, lint-staged, commitlint | Michael |
| P3 | CODEOWNERS (`dto`/`ports` compartidos) y Dependabot | Michael y Salomón |
| P2 | Auditoría de accesibilidad con axe en ambos temas del panel | Michael |
| P2 | Medir Lighthouse y bundle contra [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]] | Michael |
| P3 | Reevaluar TypeScript 7 ([[ADR-0006 - TypeScript 6.0.3 y sin Turborepo]]) | Michael |
| P3 | Revisar la carpeta `.turbo` sin uso en la raíz | Michael |

---

## Enlaces

[[ProInserco]] · [[Handoff para Backend]] · [[Checklist de Seguridad para Producción]] · [[Contenido fuente]]
