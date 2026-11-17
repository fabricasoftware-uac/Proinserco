---
tipo: adr
numero: 0002
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0002 - Backend en el mismo repositorio tras puertos

## Estado

Aceptada, 2026-11-16.

## Contexto

El frontend lo construye FabSoft (Michael, con agentes) y el backend lo implementa Salomón. Hay que decidir si el backend es un servicio aparte o vive en el mismo repositorio, y cómo trabajan dos personas sin bloquearse. El estándar del vault ([[Handoff Frontend a Backend]]) propone puertos y adaptadores en el mismo repositorio.

## Decisión

> El backend vive en el mismo repositorio, en las capas `infrastructure` de cada módulo y en `apps/web/src/server`, detrás de puertos. Cada puerto tiene un adaptador en memoria (hoy, completo) y un adaptador real (esqueleto con comentarios `// SALOMÓN:`). El interruptor es `ADAPTADORES=memoria|real`, resuelto solo en `apps/web/src/server/container.ts`.

## Alternativas consideradas

### Alternativa A - Servicio de backend aparte (API propia)
- Ventaja: despliegue y escalado independientes.
- Contra: duplica contratos (Zod en dos sitios), añade un salto de red y otra superficie de ataque, obliga a gestionar CORS y autenticación entre servicios.
- **Descartada porque**: rompe el estándar y no hay ninguna necesidad de escala que lo justifique.

### Alternativa B - Mismo repositorio, puertos y adaptadores
- Ventaja: un solo contrato (Zod + puertos); la interfaz funciona entera contra memoria desde el día 1; el backend sustituye adaptadores sin tocar la interfaz.
- Contra: dos personas en el mismo árbol; hace falta disciplina de propiedad de carpetas.
- **Elegida**.

## Consecuencias

**Positivas**
- Salomón trabaja solo en `modules/*/infrastructure/`, `src/server/` y migraciones; el frontend no espera.
- El interruptor es una sola variable; `env.ts` impide memoria en producción (salvo autorización expresa).

**Negativas**
- Si para conectar un adaptador hay que tocar `ui/` o `app/`, el contrato estaba incompleto: se para y se abre PR de contrato. Hoy hay una lista de mejoras de contrato ya identificadas (ver Handoff, sección de mejoras).
- Todavía no existen tests de contrato compartidos entre el adaptador en memoria y el real: hay que crearlos (ver Pendientes).
- No hay CODEOWNERS ni CI en el repositorio (recortados por tiempo; ver Pendientes).

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Un adaptador real cambia el comportamiento que la interfaz espera | Media | Medio | Tests de contrato compartidos antes de conectar |
| Datos de demostración llegan a producción | Baja | Alto | `env.ts` rechaza memoria en producción; checklist de salida elimina `demo.ts`, `acciones-demo.ts` y `usuarios-demo.ts` |
| Contrato modificado a escondidas | Media | Medio | Cambios en `domain/` y `application/ports/` van en PR propia revisada por los dos |

## Cómo se revierte

Extraer el backend a un servicio aparte costaría exponer los puertos como API y reescribir la composición; es posible porque los puertos ya están definidos, pero no se espera necesitarlo.

## Enlaces

- [[Handoff para Backend]]
- [[Handoff Frontend a Backend]] (vault general)
- [[ProInserco]]
