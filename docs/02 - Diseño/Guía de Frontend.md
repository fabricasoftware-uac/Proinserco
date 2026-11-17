---
tipo: guía
estado: vigente
creado: 2026-11-16
actualizado: 2026-11-17
proyecto: ProInserco
---

# Guía de Frontend

Guía breve para ubicarse en la interfaz. Diseño rector: [[Especificación del sitio]].

---

## Estructura de carpetas

```
apps/web/src/
  app/            solo rutas: (public), (auth), (app), api/
  modules/        donaciones, donantes, iam, auditoria, contenido (domain, application, infrastructure, ui)
  flujos/donar/   formulario de donación (cruza donaciones y donantes)
  server/         container.ts, env.ts, acciones.ts, auth-context.ts, csp.ts, ip.ts
  shared/         domain, application/ports, infrastructure, lib, ui/
  test/           mundo-memoria.ts
apps/web/public/  img/{aliados,demo,equipo}, marca/, sitio/intro.js
packages/         tokens (CSS en tres capas), ui, config
scripts/          pexels.mjs, verificar-primitivos.mjs
```

`shared/ui/`: `sitio/` (sitio público), `panel/` (panel), `legal/` (banner de cookies y plantilla legal), `marca/` (logo), `tema/` (tema del panel), `fuentes.ts` (Bricolage Grotesque e Instrument Sans autoalojadas).

## Tokens y temas

- Tokens en `packages/tokens/src`: `primitivos.css` (capa 1), `semanticos.css` (capa 2), `componentes.css` (capa 3) y `panel-estados.css`. No se usan colores primitivos fuera del paquete (`pnpm lint` lo comprueba).
- **Sitio público**: `[data-zona='publico']` y temas por sección con `data-seccion-tema="crema|bosque|terracota|sol|lima|cielo"`. La navbar lee el tema de la sección que tiene debajo (`section[data-seccion-tema], footer[data-seccion-tema]`) y cambia de color.
- **Panel**: `[data-zona='panel']`; claro u oscuro con `<html data-tema="claro|oscuro">`, que fija un script anti-parpadeo (`shared/ui/tema/script-tema.tsx`, con nonce) a partir del selector (`selector-tema.tsx`) o de la preferencia del sistema.
- Movimiento reducido: las duraciones colapsan en `componentes.css`; la lógica de cada animación debe comprobar `prefers-reduced-motion`.

## Sitio público: piezas y archivos

Todo en `apps/web/src/shared/ui/sitio/` salvo el banner de cookies. Concepto: «dar la vuelta» (la flecha circular del logo es el hilo); tono serio y empresarial con vida. Criterios en [[Especificación del sitio]].

| Pieza | Archivo | Notas |
|---|---|---|
| Loader con el logo | `loader.tsx` (+ `public/sitio/intro.js`, cargado con nonce desde `app/(public)/layout.tsx`) | Botón «Saltar intro» |
| Cursor propio | `cursor.tsx` | |
| Navbar tradicional con color por sección e indicador | `navbar.tsx` | Lee `data-seccion-tema` de la sección que tiene debajo; el indicador marca la sección activa; se fusiona con el footer |
| Menú a pantalla completa | `menu-pantalla.tsx` | |
| Hero con rotación de fotos | `secciones-apertura.tsx` (`Hero`), `hero-fotos.tsx` | Cambia de foto por intervalo |
| Secciones | `secciones-apertura.tsx` (Hero, QuienesSomos, QueHacemos), `secciones-trabajo.tsx` (ComoTrabajamos, Capacitaciones, Territorio), `secciones-cierre.tsx` (Valores, Aliados, Equipo, DonarCta, Contacto) | El orden lo define `app/(public)/page.tsx` («Dona hoy» va tras el hero); algunas secciones se están reorganizando, léelo allí |
| Capas «vivas» (animación de cada bloque) | `apertura-vivo.tsx`, `trabajo-vivo.tsx`, `cierre-vivo.tsx`, `pie-vivo.tsx`, `escena.tsx`, `transicion.tsx` | GSAP + ScrollTrigger; `escena.tsx` es el motor declarativo de entradas |
| Piezas gráficas propias | `flecha.tsx` (flecha del logo), `glifos.tsx`, `iconos.tsx` | Sin iconos de librería |
| Footer con fusión y crédito | `footer.tsx` | Solo muestra «Created by Fábrica de Software»; ver excepción abajo |
| Barra «Donar» móvil e «Ir arriba» | `fijos-inferiores.tsx` | |
| Banner de cookies | `shared/ui/legal/banner-cookies.tsx`, `cookies-preferencias.tsx`, `consentimiento-cookies.ts`; reabrir con `sitio/boton-cookies.tsx` | |
| Movimiento | `proveedor-movimiento.tsx` (Lenis), `movimiento.ts` | |
| Estilos | `sitio.css`, `secciones.css`, `paginas.css` | |
| Páginas de estado | `pagina-estado.tsx` | |
| Apoyos | `fotos.ts`, `enlaces.ts`, `enlace-ancla.tsx`, `fuentes-sitio.ts` | |

**Excepción de créditos.** El estándar general pide «Created by Fábrica de Software» y «Powered by EmprendeLab». En ProInserco el footer lleva solo el primero, por petición del usuario. `creditos` en `modules/contenido` conserva ambos; `footer.tsx` busca el que empieza por «Created by».

**Logos de aliados.** Los originales (`docs/01 - Cliente/material/aliados`) se pasan a PNG (máx. 960 px) con `pnpm --filter @proinserco/web marca` (`scripts/generar-marca.mjs`) y quedan en `public/img/aliados`. En `secciones-cierre.tsx`, `MEDIDAS` guarda la caja de contenido visible de cada archivo; cada logo se recorta a esa caja con CSS y se escala a la misma área visual en una celda común. Si cambias o añades un logo, vuelve a medirlo. Criterio: los logos deben verse siempre transparentes sobre el fondo de la sección.

**Notas de arquitectura**

- `shared/lib/zod-sin-eval.ts` existe porque la CSP prohíbe `eval`: Zod se configura en modo `jitless`.
- La regla de dependency-cruiser `shared-no-conoce-modulos` exceptúa `modules/contenido` (las secciones de `shared/ui/sitio` leen el contenido del sitio).

## Panel: piezas y archivos

En `apps/web/src/shared/ui/panel/`. Ninguna fecha, monto o estado se muestra como texto plano: cada dato tiene su componente.

| Archivo | Qué es |
|---|---|
| `aro.tsx` | La flecha circular del logo como motivo del panel: estados, progreso e ilustraciones salen de la misma geometría |
| `datos.tsx` | Componentes de servidor para fechas, montos, estados y demás datos |
| `identificador.tsx` | Referencias e ids con botón de copiar (opcionalmente enlace) |
| `selector-rango.tsx` | Selector de rango de fechas propio (calendario de 6 semanas, lunes primero) para filtros GET |
| `hoja-filtros.tsx` | Filtros en línea en escritorio; hoja inferior en móvil |
| `paleta.tsx` | Paleta de búsqueda (Ctrl/Cmd + K) por referencia o correo; el permiso se valida en servidor |
| `armazon.tsx` | Barra lateral con indicador deslizante, cabecera con paleta y menú de usuario |
| `menu-usuario.tsx` | Perfil, segundo factor, tema y cierre de sesión |
| `dialogo.tsx`, `primitivas.tsx`, `iconos.tsx`, `formato.ts`, `panel.css` | Apoyos |

## Tokens nuevos del sitio público

`packages/tokens/src/sitio-publico.css`: paleta «pintura» (`--pintura-bosque`, `-bosque-profundo`, `-bosque-claro`, `-lima`, `-lima-suave`, `-crema`, `-crema-clara`, `-crema-oscura`, `-arena`, `-terracota`, `-sol`, `-cielo`, `-tinta`, `-hoja`, `-hoja-viva`, `-blanco`) derivada de los primitivos; tipografías `--font-titular` (Bricolage Grotesque), `--font-cuerpo` (Instrument Sans), `--font-display` (Anybody) y `--font-enfasis` (Instrument Serif cursiva); curvas `--curva-telon` y `--curva-salto`. Se exponen a Tailwind como `--color-pintura-*`. Las fuentes se cargan en `shared/ui/fuentes.ts` y `sitio/fuentes-sitio.ts`.

## Reemplazar las fotos de Pexels por fotos reales

Las fotos de ejemplo están en `apps/web/public/img/demo/` con su manifiesto `manifiesto.json` (campos: `id`, `archivo`, `sección`, `alt`, `autor`, `autorUrl`, `url`, `ancho`, `alto`, `consulta`). Lo valida `modules/contenido/datos/imagenes-demo.ts` (archivo `.jpg`; sección `hero|agricola|educacion|salud|territorio|comunidad`).

1. Guarda la foto real como `.jpg` en `public/img/demo/` (>= 2400 px de ancho para hero, >= 1600 px para tarjetas).
2. En `manifiesto.json`, sustituye la entrada: nuevo `archivo`, `alt` descriptivo, `ancho`/`alto` reales y `autor`/`url` de la fuente real (o la atribución que pida la licencia).
3. Las secciones piden las fotos por nombre de archivo sin extensión con `fotoDemo('hero-32419583')` (en `secciones-apertura.tsx` y `secciones-trabajo.tsx`). **Si cambias el nombre del archivo, actualiza esas llamadas**; `fotoDemo` falla en el build si no existe. Lo más simple es conservar el nombre y sobrescribir.
4. El footer ya no muestra créditos de fotos (ver [[Pendientes]]): al sustituir las de Pexels, confirma la atribución que exija la licencia de las fotos nuevas.
5. **Añadir fotos de demostración nuevas**: agrega una búsqueda en `BUSQUEDAS` de `scripts/pexels.mjs` (`termino`, `seccion`, `alt`, `cantidad`, `minAncho`, `ancho`) y ejecuta `pnpm imagenes:pexels` (lee la clave de `apps/web/.env.local`; nunca la copies a otro archivo). Descarga a `public/img/demo`, actualiza el manifiesto y respeta `scripts/pexels-descartadas.json`; luego pide la foto con `fotoDemo(...)`. El script respeta las ediciones del manifiesto, pero **no lo ejecutes** si ya hay fotos reales sin revisar su comportamiento. Equipo y aliados no usan el manifiesto: están en `public/img/equipo` y `public/img/aliados` y salen de `docs/01 - Cliente/material` con `pnpm --filter @proinserco/web marca`.
6. Rotar la clave de Pexels (ver [[Checklist de Seguridad para Producción]]).

## Editar el contenido

Todo el texto del sitio vive en `apps/web/src/modules/contenido/datos/contenido-sitio.ts`, validado por el esquema Zod de `modules/contenido/domain/esquemas.ts` (un campo mal escrito rompe el build/test, `contenido-sitio.test.ts`). Bloques: `organizacion`, `contacto`, `quienesSomos`, `misionVision`, `queHacemos`, `comoTrabajamos`, `capacitaciones`, `territorio`, `aliados`, `valores`, `principios`, `equipo`, `donar` (montos sugeridos), `legal` (`versionPoliticaDatos`, estado de borrador) y `creditos`.

- Lo que falta se marca `TODO-CONTENIDO` y se lista en `PENDIENTES_CONTENIDO`; **no inventes datos**: la fuente es [[Contenido fuente]].
- Al cambiar el texto legal, cambia `versionPoliticaDatos`: queda registrada en cada consentimiento.
- El panel y las páginas legales no salen de este archivo (las legales son componentes en `app/(public)/legal`).

---

## Enlaces

[[Especificación del sitio]] · [[ProInserco]] · [[Pendientes]] · [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]]
