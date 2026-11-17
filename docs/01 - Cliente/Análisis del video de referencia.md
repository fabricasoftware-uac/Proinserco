---

tipo: referencia
estado: vigente
creado: 2026-11-16
actualizado: 2026-11-16
---

# Análisis del video de referencia (`videoanimaciones.mp4`)

Archivo: `material/originales/videoanimaciones.mp4`. Método: ffprobe + 24 fotogramas (2 por segundo) vistos en hojas de contacto. [V] = visto en fotogramas. [I] = inferido. La muestra a 2 fps no capta curvas de easing finas; los timestamps tienen un margen de ±0.5 s. No se analizó el audio.

## Datos técnicos [V]

H.264, 1600x1200 (4:3), 60 fps, 12.000 s. Empieza y termina en el mismo estado ("How it Works"): es un ciclo continuo, loop sin costura.

## Qué es [V]

Un mock de sitio tipo plataforma de donaciones, parecido a un rediseño de GlobalGiving (las imágenes 6, 7 y 8 de `material/referencias-diseno/` son la misma pieza de concepto: hero "Building a Better World", "How it Works", grid de proyectos, mapa "Disaster Recovery", logos corporativos, testimonios, noticias y footer verde). Es referencia de movimiento y de estilo; el contenido NO es de Proinserco.
Se presenta dentro de un **mockup de pantalla**: fondo con foto desenfocada fija (manos y vegetación), encima un marco crema redondeado (bezel) con la "ventana" del sitio dentro.

## Línea de tiempo

- **0.0-1.0 s**: sección hero verde oscuro (~#1F3A24 [I]) con el título "How it Works" en tipografía display gruesa y redondeada, color crema, centrado. Nav fijo arriba (logo, buscador pill "Search project to donate...", icono de grilla, pill "Gift Cards"). Botón circular scroll-down (flecha ↓) en una muesca semicircular del borde inferior del marco. El título deriva levemente hacia arriba (parallax sutil de scroll) entre 0.0 y 1.0 s.
- **1.0-3.0 s**: las tarjetas de color **entran desde el borde derecho** (translate-X con **stagger**): 01 Nonprofits (naranja terracota), 02 Donors (amarillo), 03 Companies (verde lima), 04 Our Impact (azul grisáceo). Cada una llega con una **rotación leve y distinta** (efecto pila de papeles sueltos) y con un patrón de líneas topográficas finas como textura. Mientras entran, el título sube y queda **parcialmente tapado**: las tarjetas pasan por delante del texto (z-order). Indica una **sección pinned con timeline scrubbed por scroll** [I].
- **3.0-4.5 s**: hold. Las 4 tarjetas alineadas en abanico tipo collage, el título asoma detrás.
- **4.5-5.5 s**: sigue el scroll: tarjetas y título suben y **entra desde abajo la siguiente sección**: fondo crema con tabs/filtros ("Explore Projects: Featured / Newest / Nearly Funded / Child Protection / More") y una **bento/masonry grid de fotos de proyectos**. La sección nueva se superpone a la anterior (**section stacking / reveal**), que se mueve menos: **parallax de capas**.
- **5.5-6.5 s**: la grid llega a su posición. La nav verde oscura queda como **barra flotante sticky** (pill de bordes redondeados) sobre el contenido crema. Las tarjetas de foto tienen esquinas redondeadas, texto abajo-izquierda sobre degradado oscuro y un botón circular blanco con flecha ↗. Una tarjeta es naranja con texto grande ("Easily create a fundraiser for a project you believe in" + botón negro "Get Started"). Otra destaca una cifra grande ("$335,158 Raised") sobre foto.
- **6.5-9.0 s**: **scroll vertical continuo**: la grid sube pasando por detrás de la nav sticky (el contenido se recorta bajo ella). Aparecen filas nuevas de fotos. El movimiento es suave y con inercia (**smooth scroll tipo Lenis** [I]).
- **9.0-10.0 s**: final de la grid; aparece el botón pill negro "Browse all Projects". La nav verde **crece hacia abajo** y tapa la grid (transición de salida tipo **wipe / panel reveal**).
- **10.0-11.0 s**: pantalla verde plena (cierre); la grid se ve atenuada con un fade de opacidad.
- **11.0-12.0 s**: reaparece "How it Works" con **fade-in desde baja opacidad** (texto crema parte de gris verdoso y sube a pleno) y el botón scroll-down. Vuelve al fotograma inicial (**loop sin costura**).

## Elementos transversales (términos técnicos)

- Scroll-driven timeline con pinning (ScrollTrigger pin + scrub).
- Stagger de entrada lateral con rotación aleatoria controlada.
- Overlap y z-layering de tarjetas sobre el título.
- Nav sticky con clip/máscara sobre el contenido que pasa por debajo.
- Bento grid con esquinas redondeadas y overlay de degradado.
- Smooth scrolling con inercia.
- Mockup de dispositivo como "viewport frame" con bordes redondeados y scroll cue en una muesca.
- Tipografía display gruesa y redondeada; paleta verde bosque, crema, naranja, amarillo, lima y azul grisáceo.

## No observado

Cursor personalizado, marquees (en la imagen 6 hay una cinta de logos corporativos, pero no se mueve en el video), efectos hover, tipografía animada por caracteres (SplitText). El fondo con foto desenfocada no se mueve (sin parallax).

## Fotogramas representativos

En `material/referencias-diseno/`: `video-t0.0s.jpg`, `video-t1.5s.jpg`, `video-t3.5s.jpg`, `video-t5.0s.jpg`, `video-t7.5s.jpg`, `video-t10.5s.jpg`.
