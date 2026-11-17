---
tipo: adr
numero: 0006
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0006 - TypeScript 6.0.3 en lugar de 7, y sin Turborepo

## Estado

Aceptada, 2026-11-16.

## Contexto

Dos desviaciones del [[Stack Tecnológico Estándar]] y de la [[Plantilla - Nuevo Proyecto]]:

1. **TypeScript.** TypeScript 7 (compilador nativo) es la versión más reciente. El propio estándar dice que, antes de adoptarlo, hay que comprobar que `next build`, Biome, Vitest y `dependency-cruiser` funcionan con él. Con TypeScript 7 hoy **no funcionan Next ni dependency-cruiser** en este proyecto, así que `pnpm verify` no pasaría.
2. **Turborepo.** La plantilla de arranque lista Turborepo. El monorepo tiene una sola aplicación (`apps/web`) y tres paquetes pequeños (`packages/tokens`, `packages/ui`, `packages/config`).

## Decisión

> Fijamos `typescript` en **6.0.3** (versión exacta) en la raíz (`package.json`) y en `apps/web`/`packages/tokens`, y no usamos Turborepo: los scripts del monorepo usan `pnpm -r` y `pnpm --filter`.

Los scripts quedan así (`package.json` raíz): `pnpm typecheck` (`pnpm -r typecheck`), `pnpm test` (`pnpm -r test`), `pnpm verify` (typecheck + lint + depcruise + test + build).

## Alternativas consideradas

### Alternativa A - TypeScript 7
- Ventaja: compilación mucho más rápida.
- Contra: rompe Next y dependency-cruiser hoy.
- **Descartada porque**: sin dependency-cruiser no se puede garantizar la regla de capas.

### Alternativa B - Turborepo
- Ventaja: caché de tareas entre paquetes.
- Contra: añade otra herramienta y configuración sin beneficio con una sola app y paquetes diminutos.
- **Descartada porque**: no aporta nada a este tamaño.

## Consecuencias

**Positivas**
- `pnpm verify` funciona con todas las piezas del estándar.
- Una herramienta menos que mantener.

**Negativas**
- Compilación de tipos más lenta que con TS 7.
- Sin caché de tareas: si el monorepo crece, hay que reconsiderarlo.
- Hay que **revisar la migración a TS 7 periódicamente** (tarea fechada abajo).

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Se queda en TS 6 para siempre | Media | Bajo | Revisar al actualizar Next o dependency-cruiser; probar `pnpm verify` con TS 7 en una rama |

## Tarea fechada

Reevaluar TypeScript 7 en el siguiente cambio mayor de Next.js o dependency-cruiser, y como máximo en **2027-02-16** (fecha propuesta; ajustar con Michael).

## Cómo se revierte

Subir TypeScript es cambiar una versión exacta y correr `pnpm verify`. Añadir Turborepo después es un archivo `turbo.json` y scripts: coste bajo. (Nota: en la raíz del repositorio existe una carpeta `.turbo` sin uso aparente; revisar si se borra.)

## Enlaces

- [[Stack Tecnológico Estándar]] · [[Plantilla - Nuevo Proyecto]] (vault general)
- [[ProInserco]]
