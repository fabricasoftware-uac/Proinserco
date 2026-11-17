---
tipo: adr
numero: 0005
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0005 - Presupuesto de rendimiento alternativo por animación intensiva

## Estado

Aceptada, 2026-11-16. Las cifras medidas están **pendientes** (ver "Cómo se verifica").

## Contexto

La [[Especificación del sitio]] pide un sitio "nivel Awwwards" con la animación como protagonista: loader con el logo, navbar que cambia de tema por sección, secciones apiladas, una sección fijada con tarjetas que entran escalonadas, texto que se revela con el scroll, fusión navbar-footer y menú a pantalla completa. Eso se construye con **GSAP 3.15.1** (ScrollTrigger, SplitText, Flip, DrawSVG) y **Lenis 1.3.27**, ambos en `apps/web/package.json`. El presupuesto general del vault (JS inicial < 120 KB comprimido, Lighthouse >= 90) no cabe con esas librerías cargadas de entrada.

El vault ([[Animación y Movimiento]], "Presupuesto para sitios de marketing con animación intensiva") permite un presupuesto alternativo **si se registra con una ADR**.

## Decisión

> Adoptamos el presupuesto alternativo del vault para el sitio público.

| Métrica | Presupuesto |
|---|---|
| JS crítico (lo necesario para pintar y para el LCP) | < 120 KB comprimido (igual que el general) |
| JS de animación diferido (GSAP, plugins, Lenis, escenas) | < 150 KB comprimido adicionales, cargados después del LCP |
| LCP (móvil, 4G simulada) | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1, y 0 durante loader, menú y fusión navbar-footer |
| Lighthouse Rendimiento (móvil) | >= 80 |
| Lighthouse Accesibilidad | >= 95 (no se relaja nunca) |

El panel (`/panel`, `/acceso`) **no** usa animación intensiva y se mide contra el presupuesto general.

## Alternativas consideradas

### Alternativa A - Presupuesto general
- Ventaja: sin excepciones.
- Contra: obliga a renunciar a ScrollTrigger/SplitText y al efecto central del diseño.
- **Descartada porque**: contradice el objetivo del proyecto.

### Alternativa B - Animar solo con CSS y View Transitions
- Ventaja: casi sin JS.
- Contra: no alcanza la sección fijada con tarjetas escalonadas ni el revelado por palabras con la fiabilidad que se pide.
- **Descartada porque**: CSS scroll-driven y View Transitions se mantienen solo como mejora progresiva.

### Alternativa C - WebGL/3D
- **Descartada** en la especificación: peso en móvil sin aportar al mensaje.

## Consecuencias

**Positivas**
- Se conserva el diseño que pide el cliente, con límites explícitos en lugar de incumplir en silencio.

**Negativas**
- Rendimiento móvil de 80 en vez de 90.
- Más complejidad: animaciones en `apps/web/src/shared/ui/sitio/animaciones-inicio.tsx` dentro de un `gsap.matchMedia` (escritorio, móvil, movimiento reducido), con limpieza al desmontar.
- Con movimiento reducido no hay Lenis ni animaciones: hay que mantenerlo (`proveedor-movimiento.tsx`).

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El JS de animación entra en el camino crítico | Media | Alto | Cargar GSAP/Lenis después del LCP; medir con bundle analyzer |
| Jank en móviles de gama baja | Media | Medio | Animar solo `transform`/`opacity`; estados iniciales en CSS (`sitio.css`); probar en dispositivo real |
| Se relaja la accesibilidad por la animación | Baja | Alto | Umbral de accesibilidad >= 95 fijo; auditoría axe (pendiente, ver Pendientes) |

## Cómo se verifica

Las cifras reales **no se han medido todavía**. Antes del lanzamiento: Lighthouse móvil sobre la versión compilada (`pnpm build` y `pnpm start`, nunca `next dev`), `@next/bundle-analyzer` para el JS, y anotar aquí los valores medidos. Lighthouse CI no está configurado (ver Pendientes).

## Cómo se revierte

Quitar la animación intensiva significa rediseñar secciones; el coste es alto. Si las cifras no se cumplen, se simplifica por sección antes de relajar el presupuesto.

## Enlaces

- [[Animación y Movimiento]] · [[Renderizado y Caché]] (vault general)
- [[ADR-0004 - CSP con nonce y páginas dinámicas]]
- [[Guía de Frontend]]
- [[ProInserco]]
