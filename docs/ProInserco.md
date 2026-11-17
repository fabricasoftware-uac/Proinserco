---
tipo: proyecto
estado: desarrollo
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
---

# ProInserco

Índice y ficha del proyecto (según [[Plantilla - Nuevo Proyecto]]).

---

## Ficha

| Campo | Valor |
|---|---|
| **Proyecto** | ProInserco, sitio y panel de la Fundación Proinserco |
| **Cliente** | Fundación Proinserco (Popayán, Cauca) |
| **Directorio** | `D:\FabSoft\ProInserco` |
| **Repositorio** | Aún no inicializado: Michael lo crea y hace el primer commit |
| **Inicio** | 2026-11-16 |
| **Estado** | Desarrollo: frontend completo con adaptadores en memoria; backend pendiente |
| **Responsable** | Michael (FabSoft, frontend); Salomón (backend y despliegue) |

## Contexto de negocio

La Fundación Proinserco es una fundación sin ánimo de lucro de Popayán que trabaja con comunidades del Cauca en capacitaciones (educación, salud, agrícola) y elaboración y ejecución de proyectos. Hoy su sitio es un Wix. Detalle en [[Contenido fuente]].

Este proyecto lo sustituye por un sitio nuevo de nivel alto en diseño y animación, cuyo objetivo es convertir visitas en donaciones en línea, más un panel interno para consultarlas.

## Objetivo

- Sitio público que carga rápido y se siente premium en móvil y escritorio (presupuesto en [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]]).
- Flujo de donación de punta a punta con checkout hospedado de Openpay.
- Panel con donaciones, donantes y auditoría, con MFA obligatorio.
- Salomón conecta el backend sin tocar la interfaz.

## Alcance

**Dentro:** sitio público, flujo de donación, login con segundo factor, panel (resumen, donaciones, donantes, auditoría, ajustes), textos legales en borrador.

**Fuera:** donación recurrente, blog, tienda, multidioma, textos legales definitivos, envío de correos y certificados (hoy no existen en el código).

---

## Preguntas de arranque

| Pregunta | Respuesta | Si no está definida |
|---|---|---|
| ¿Sitio público, aplicación autenticada o ambos? | Ambos: `(public)`, `(auth)` y `(app)` | — |
| ¿Hosting? | VPS DigitalOcean con Coolify detrás de Cloudflare ([[ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare]]) | — |
| ¿Proveedor de identidad? | Supabase Auth con MFA TOTP (puerto `IdentityProvider`; hoy en memoria) | — |
| ¿Multi-tenant? | No: una sola fundación | — |
| ¿Datos personales sensibles? | Datos personales de donantes, incluido documento de identidad; no sensibles en sentido legal | Paquete legal y banner de cookies (hechos en borrador) |
| ¿Transacciones económicas? | Sí, donaciones | Auditoría y estados (hechos) |
| ¿Volumen esperado? | No definido | Paginación por cursor ya implementada |
| ¿Sustituye a un sitio existente? | Sí, el Wix actual | **Pendiente: inventariar URLs para los 301** (no hecho) |
| ¿Idiomas? | Español (Colombia) | — |
| ¿Marca definida? | Sí, a partir del logo; falta el logo vectorial original | Ver [[Pendientes]] |
| ¿Pagos en línea? | Openpay Colombia, checkout hospedado por redirect, alcance PCI mínimo ([[ADR-0001 - Checkout hospedado de Openpay por redirect]]) | — |
| ¿Trata datos personales? | Sí | Paquete legal en borrador, pendiente de abogado |
| ¿Panel administrativo? | Sí, MFA obligatorio | — |
| ¿DDoS y anti-bots? | Cloudflare delante y Turnstile verificado en servidor | — |
| ¿Sitio público con interfaz obligatoria? | Sí; ver [[Guía de Frontend]] | — |
| ¿Quién hace frontend y backend? | Michael y Salomón; contrato primero ([[ADR-0002 - Backend en el mismo repositorio tras puertos]]) | — |
| ¿Imágenes? | De ejemplo de Pexels con manifiesto; el cliente entregará las reales | Ver [[Guía de Frontend]] |

## Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `donaciones` | Crear intención de donación, estados, conciliación, consulta | Puertos propios (`RepositorioDonaciones`, `PasarelaPagos`, `RegistroDeDonantes`) y transversales |
| `donantes` | Datos del donante y consentimientos | Transversales |
| `iam` | Sesión, roles, MFA | Transversales |
| `auditoria` | Registro de acciones, solo inserción | Transversales |
| `contenido` | Contenido del sitio, estático y tipado | Nada |
| transversales (`shared`) | `Reloj`, `VerificadorAntiBots`, `LimitadorDeTasa`, `PublicadorEventos`, `Auditor`, `GeneradorIds` | — |

Los módulos no se importan entre sí; se unen en `apps/web/src/server/container.ts` y en `apps/web/src/flujos/`.

## Desviaciones del estándar

| Desviación | Motivo | ADR |
|---|---|---|
| Checkout hospedado por redirect (no tokenización en página) | Alcance PCI mínimo; Openpay.js para Colombia sin verificar | [[ADR-0001 - Checkout hospedado de Openpay por redirect]] |
| Backend en el mismo repositorio tras puertos | Estándar de handoff | [[ADR-0002 - Backend en el mismo repositorio tras puertos]] |
| VPS con Coolify en lugar de Vercel | Infraestructura existente | [[ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare]] |
| CSP con nonce, HTML dinámico | Seguridad sin `unsafe-inline` | [[ADR-0004 - CSP con nonce y páginas dinámicas]] |
| Presupuesto de rendimiento alternativo | GSAP y Lenis | [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]] |
| TypeScript 6.0.3 y sin Turborepo | TS 7 incompatible hoy con Next y dependency-cruiser | [[ADR-0006 - TypeScript 6.0.3 y sin Turborepo]] |
| Documento a todo donante (propuesta) | Certificado y debida diligencia | [[ADR-0007 - Tipo y número de documento a todo donante]] |

---

## Estado actual

- **Frontend**: completo, funciona entero con adaptadores en memoria (`ADAPTADORES=memoria`), con pasarela simulada y datos ficticios. El Turnstile ya está implementado; las páginas legales son borradores con marcadores `[POR DEFINIR]`.
- **Backend**: pendiente. Los adaptadores reales son esqueletos que lanzan `NoImplementado`.
- **Faltan** (ver [[Pendientes]]): Dockerfile, CI, E2E, tests de contrato, conciliación, correos, datos del cliente.

## Mapa de documentos

| Documento | Para qué |
|---|---|
| [[Especificación del sitio]] | Documento rector |
| [[Contenido fuente]] · [[Análisis del video de referencia]] | Cliente y referencia visual |
| [[Guía de Frontend]] | Estructura, temas, fotos y contenido |
| [[Handoff para Backend]] | Documento principal para Salomón |
| [[Checklist de Seguridad para Producción]] | Antes de salir |
| [[Pendientes]] | Cliente, backend, legal y técnicos |
| ADR-0001 a 0007 | `docs\03 - Decisiones\` |

## Enlaces

Vault general (solo lectura): `D:\FabSoft\Documentación Proyectos`. [[Plantilla - Nuevo Proyecto]] · [[Plantilla - ADR]] · [[Handoff Frontend a Backend]] · [[Pagos en Línea y Pasarelas]] · [[Privacidad y Habeas Data]] · [[Protección contra DDoS, Bots y Abuso]] · [[Despliegue en VPS con Coolify]]
