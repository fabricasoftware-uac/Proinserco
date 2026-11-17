---
tipo: referencia
creado: 2026-11-16
---

# Lenguaje de diseño FabSoft

Estudio de tres sitios de la agencia que el cliente considera "muy animados y bonitos": **Genix** (Fungo Genix, `D:\FabSoft\Genix`), **Inventia** (`D:\FabSoft\Inventia`) y **Cafetal** (`D:\FabSoft\Cafetal`). Objetivo: destilar qué los hace sentirse como una *experiencia* y no como una plantilla, para rediseñar el frontend de ProInserco a ese nivel. Solo lectura sobre los tres proyectos.

**Método.** Código leído en cada proyecto (loader, navbar, menú, hero, secciones, cursor, footer, transiciones), sus `docs\` y el estándar `Animación y Movimiento`. Los tres se levantaron en desarrollo (puertos 3401, 3402, 3403) y se capturaron con Playwright a 1440 y 390 px: loader, hero, seis momentos de scroll, menú abierto, hovers y transición de página. Capturas en `docs\01 - Cliente\material\referencias-diseno\fabsoft\{genix,inventia,cafetal}\`. Los servidores se detuvieron al terminar.

**Stack común (los tres):** Next 16, React 19, Tailwind 4, GSAP 3.15 (+ `@gsap/react`, ScrollTrigger, SplitText, DrawSVG, MorphSVG, Physics2D, CustomEase) y Lenis. Inventia añade Three.js (bombillo en partículas con bloom) y Motion; Cafetal añade Three.js (taza y sachet GLB). **ProInserco ya tiene GSAP 3.15, Lenis, SplitText y pins**: la maquinaria existe; lo que falta es dirección de arte, piezas firma y atrevimiento. No es un problema de librerías.

Capturas de referencia clave (carpeta `fabsoft\`): `genix\1440-00-loader-1200.png`, `genix\1440-03-menu-mitad.png`, `genix\1440-05-menu-hover-enlace.png`, `genix\1440-07-transicion-pagina.png`, `inventia\1440-02-scroll-2.png` (persiana), `inventia\1440-05-menu-hover-enlace.png`, `inventia\1440-06-hero-mantener-explota.png`, `cafetal\1440-00-loader-1200.png`, `cafetal\1440-01-hero.png`, `cafetal\1440-03-menu-desplegable.png`.

---

## A. Qué tienen en común las tres

**1. Cada sitio tiene UNA idea-mundo y todo la obedece.** No es "una web de X con buen diseño"; es un lugar con reglas físicas propias.
- Genix: *el sitio es un juego rubber-hose/cartoon* (Cuphead). Telones de sombrero de hongo, un cursor que es el personaje, scrollbar con un hongo de thumb, interruptor de palanca para cambiar de marca, tele de dibujos en el footer. Referencia: `docs\02 - Diseño\Lenguaje de movimiento.md` ("Todo responde, todo se mueve con intención").
- Inventia: *un laboratorio de prototipado*. Partículas que forman el bombillo, capas de impresión 3D como borde del footer, "mantén presionado para desarmar la idea", persiana de barras como impresora.
- Cafetal: *una taza que se prepara*. La intro es un sachet que se zambulle en café, la transición de página es una ola de café que sube ("Sirviendo…"), el botón de volver arriba estalla en granos, el cursor es un grano que se vuelve taza sobre los enlaces.

La metáfora aparece en el loader, el cursor, el menú, la transición, el botón de subir y el footer. Ese eco repetido es lo que da la sensación de "mundo". ProInserco hoy tiene un estilo, no un mundo.

**2. Una pieza "firma" por zona, y la firma es un objeto con comportamiento, no una decoración.** Mascota con estados (Genix), bombillo de 30 000 partículas que explota al mantener el clic (Inventia), taza 3D con vapor que se llena según lo que elijas (Cafetal). Son piezas con las que se *juega*, y por eso se recuerdan.

**3. Tipografía como protagonista y como imagen.**
- Escala brutal: titulares de `clamp(3rem, 7vw, 10rem)` (Inventia `--text-mega: clamp(3.25rem, 10.5vw, 10rem)`, interlineado 0.86, tracking −0.045em; Cafetal `--text-mega: clamp(4.2rem, 10.5vw, 11rem)`).
- Contraste de escala dentro de la misma frase: Cafetal escribe "CAFÉ **que** DESPIERTA" con la palabra pequeña en Fraunces itálica entre palabras enormes en Big Shoulders condensada; Genix mezcla Wobbly (titular) con una palabra de énfasis en otra fuente amarilla ("con *dedicación*.").
- Dos o tres fuentes con rol distinto (display condensada/loca + serif cálida + tipografía de sello), nunca una sola sans para todo.
- El texto es máscara o ventana: en la portada de Cafetal las letras "CAFÉ DE ORIGEN" son una ventana al video a plena luz (`mix-blend-mode: multiply`) mientras el resto del video está oscurecido al ~45 %, y al hacer scroll la cámara entra por la "O". Inventia mete un clip de video *dentro* de la palabra "PROTOTIPOS" en el titular.

**4. Densidad de movimiento alta pero con jerarquía de tres capas.** (a) Ambiente continuo y lento (derivas, polvo, estrellas, marquee, parpadeo); (b) respuesta al puntero (cursor, parallax de ratón con `quickTo`, magnéticos, previews que siguen al cursor); (c) coreografía al scroll (pin, scrub, persianas, pistas horizontales). Nunca hay un momento en que todo esté quieto, y nunca todo se mueve a la vez: una cosa manda por pantalla.

**5. Entradas distintas entre secciones contiguas.** Genix lo tiene como regla: `data-rev` con siete variantes (`subir`, `izq`, `der`, `zoom`, `clip`, `giro`, `caer`) en `modules\sitio\ui\secciones\use-escena.ts`; el estándar de la agencia lo dice igual: "variar la entrada entre secciones contiguas; si todo aparece igual, el movimiento deja de percibirse".

**6. Color con carácter y cambio de color como evento.** Genix alterna verde saturado / crema / blanco / verde noche / lima a bandazos y su navbar cambia de paleta según la sección que tiene debajo (`paletas-nav.ts`). Inventia pasa de negro grafito a barras marfil (persiana) a un panel naranja pleno con patrón de infinitos (`inventia\1440-02-scroll-6.png`). Cafetal va de espresso a verde bosque profundo a dorado. No hay "fondo blanco con tarjetas": las secciones son *planos de color* a pantalla completa, y la transición entre ellos es parte del espectáculo (borde ondulado en Genix, persiana de barras en Inventia, ola de café en Cafetal).

**7. Asimetría, capas y rotación.** Elementos girados 2-8° (pegatinas del navbar de Genix, polaroids de Cafetal), titulares escalonados con sangría distinta por línea (Inventia: `md:pl-[1.1em]`, `md:pl-[1.9em]`), objetos que invaden la sección vecina, recortes de caja sobre tarjetas, sombras duras de color (`box-shadow: 5px 5px 0` en `.boton-juego` de Genix). Se ve compuesto a mano, no auto-maquetado.

**8. Humor y sorpresa en los rincones.** Genix: un hongo que silba mientras camina por el camino que *es* la barra de progreso; "Despertando a Pleu…". Cafetal: "Calentando el agua / Abriendo el sobre / Infusionando / ¡Tu taza está lista!" como textos del loader; "Sirviendo…" en la transición. Inventia: "Mantén presionado para desarmar la idea". Los textos de sistema tienen voz.

**9. Cada interacción tiene física y rastro.** Squash & stretch del cursor; botones que se elevan con `translate(-2px,-4px) rotate(-1.5deg)` y se hunden al pulsar; granos y chispas con gravedad (Physics2D) al hacer clic; íconos que se "imprimen" al pasar el ratón por el pie de Inventia. El clic nunca es mudo.

**10. Disciplina técnica debajo del espectáculo.** `prefers-reduced-motion` respetado en todo, temporizador de seguridad en loader y telones (8-10 s), loader solo la primera vez (`sessionStorage`/`localStorage`), `quickTo` para todo lo que sigue al puntero, solo `transform`/`opacity`/`clip-path`, estado inicial en CSS para evitar destellos de SSR, bucles pausados fuera de pantalla. Esto es lo que impide que "muy animado" se convierta en "pesado".

---

## B. Catálogo de patrones por pieza

Rutas relativas a `D:\FabSoft\`. Abreviaturas: **G** = Genix (`Genix\apps\web\src\modules\sitio\ui\`), **I** = Inventia (`Inventia\src\components\`), **C** = Cafetal (`Cafetal\src\components\`).

### B1. Loader

| Patrón | Dónde | Qué hace |
|---|---|---|
| **El progreso es un objeto que viaja** | G `loader\orquestador-loader.ts` (`iniciarCompleto`), `bucle-caminata.ts`, `secuencia-llegada.ts` | Un hongo (SVG con rig de partes) camina silbando por un camino serpenteante dibujado; el camino ES la barra y el avance lo mide `medidor-carga.ts` (carga real). Notas musicales flotan desde la boca. Al llegar (`reproducirLlegada`): salta (`y: -subida`, 0.27 s `power2.out`), el wordmark brota letra a letra con SplitText `{y:80, scale:0, rotation: random(-28,28)}` → `ease:'salto'`, `stagger:0.07`, aterriza con squash, saluda y a 2.5 s pide el telón. `abrirTelon`: dos paneles crema con halftone se separan `xPercent ±101`, 0.95 s `ease:'telon'`. **La página entra cuando el telón EMPIEZA a abrirse** (evento `EVENTO_INTRO_FIN`), no al terminar. Solo primera visita, seguridad 9 s, CSS de rescate a 12 s. |
| **Un líquido que sube con el %** | C `intro\Intro.tsx` (`Intro`) | Sachet colgando de un hilo con etiqueta dorada; péndulo `rotation -9↔9`, 0.9 s `sine.inOut` yoyo mientras carga. Entra con `y:-420` `elastic.out(1,0.55)`. Contador 0→100 en 2.4 s `power1.inOut`; el café sube de `yPercent 88` a `62` en paralelo con superficie de ola SVG que se desplaza -50 % en bucle (`ONDA`). Frases del loader cambian por tramos del %. Etiqueta `salida` a 2.75 s: el sachet se zambulle (`y:34vh`, `power3.in`), 6 gotas salpican con destinos fijos, el café inunda (`yPercent -6`), aparece el logo con `back.out(1.8)`, y todo el overlay sube (`yPercent -105`, 0.95 s `power3.inOut`). Botón "Saltar intro" (`tl.seek`). Seguridad 8 s. |
| **Trazo + chispa + luz que crece** | I `sistema\Loader.tsx` (`Loader`) | Rueda propia con `requestAnimationFrame` y `DURACION = 3600`. 0–45 %: una chispa recorre el infinito (`getPointAtLength`) soltando destellos naranja; 35–80 %: el bombillo se traza (DrawSVG); 70–92 %: la palabra se revela con `clip-path: inset(0 X% 0 0)`. Línea de progreso `scaleX: p`, contador `000`→`100` en `tabular-nums`, luz naranja de abajo que crece y **cuatro destellos de intensidad creciente en 80/88/94/98 %**; en 100 el destello total ilumina toda la pantalla y abre el sitio. Detrás, el lienzo 3D (`escena\`) materializa las partículas en bombillo. Marca `localStorage` `inventia:intro-vista`; script inline en `layout.tsx` evita el destello. |

**Por qué funciona:** el tiempo de espera cuenta una micro-historia con principio, giro y remate; el remate (telón, inundación, destello) *desvela* la web, no la sustituye; los textos tienen humor.

### B2. Navbar

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Pegatinas giradas que cambian de paleta** | G `navegacion\barra-navegacion.tsx`, `paletas-nav.ts`, `enlaces-sitio.ts`, `hooks-navegacion.ts` | Píldoras con contorno grueso, giradas ligeramente (`giro` por enlace), sin barra continua. Cada paleta (`green/egg/white/night/lime/coffee`) define `marca, relleno, texto, contorno, acento, fondo`; se aplican como variables CSS `--nav-*` según el tema de la sección bajo la línea del navbar. Se ocultan al bajar y reaparecen al subir (translateY); el burger nunca se oculta. |
| **Navbar que lee lo que tiene debajo** | I `sistema\Navbar.tsx` | Lee `document.elementsFromPoint` a 8 % y 50 % del ancho a media altura del navbar en cada scroll (rAF) y toma el `[data-tema]` más alto; sirve para fondos que cambian por dentro (barras de la persiana, panel naranja de la pista horizontal). Hay **una versión del logo por fondo** y se funden con `opacity` 500 ms. Sondeo cada 250 ms mientras corre un `scrub`. Solo "COTIZA" (píldora llena) + "MENÚ" (píldora contorno): dos acciones, nada más. |
| **Fusión navbar–footer en un marco** | G `navegacion\marco-pantalla.tsx`; I `Navbar.tsx` + `inicio\Cierre.tsx` (`data-footer`, `--alto-navbar`) | Al llegar el footer a 12 px del borde (`ScrollTrigger.create` `top 12px`) el navbar se acopla: en Genix cuatro barras crecen con `scaleX/scaleY` girando en sentido horario formando un bisel de "tele" y las pegatinas se reparten por las esquinas; en Inventia el footer reserva exactamente la altura del navbar para que juntos llenen la pantalla (min-h-dvh). |
| **Navbar con "casa" y megamenú de tarjetas** | C `navegacion\Barra.tsx` (`PANELES`, `abrir`, `cerrarLuego`) | Dos píldoras oscuras a cada lado de una **etiqueta dorada colgante con el logo** (la "casa"), botón redondo de sonido a la izquierda y de carrito/WhatsApp a la derecha. Hover en "Nosotros ▾" abre un panel con titular condensado + **tarjetas con foto** de cada destino (ver `cafetal\1440-03-menu-desplegable.png`). Cierre con retardo de 160 ms para no parpadear. Sobre secciones claras (`data-nav="claro"`) las píldoras se vuelven translúcidas. |

**Por qué funciona:** la navegación es la marca (etiqueta, sombrero, píldoras) y reacciona a dónde estás; el footer es el "cierre del marco", no una caja aparte.

### B3. Menú a pantalla completa

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Barrido circular en tres capas desde el botón** | G `navegacion\menu-completo.tsx` (`construirApertura`/`construirCierre`) | Tres capas (`bg-fungo-green`, `lime`, `egg`) con `clip-path: circle(0 at origen)`; el origen es el centro del burger medido en px y cada capa nace con un desvío (−36,18 / 28,−14 / 0,0) para que el barrido sea orgánico. Se abren a `radioHasta(origen)` en 0.9 s `ease:'telon'`, escalonadas 0.12 s. Cierre en orden inverso. Enlaces: `SplitText type:'chars', mask:'chars'`, `yPercent 115, rotation 8 → 0`, 0.75 s, `stagger 0.022`, empezando a 0.55 s. Botón de cerrar `scale 0.6 → 1` con `salto`. El burger tiene forma de sombrero y sus tres rayas se funden en una X. |
| **Preview que sigue al cursor** | G `navegacion\previa-menu.tsx`, `mascotas-menu.tsx` | Al pasar por un enlace aparece una ilustración enmarcada que sigue al puntero con `quickTo` (x, y y rotación según velocidad horizontal) y se intercambia con rebote; Pleu asoma por el borde izquierdo y Otus por abajo, saludando (`genix\1440-05-menu-hover-enlace.png`). Enlace activo con subrayado ondulado (`.menu-onda`). Foco atrapado, Esc cierra, scroll bloqueado con `useLenis().detener()`, `data-lenis-prevent` en el contenido. |
| **Persiana de barras + enlaces gigantes que se desenfocan** | I `sistema\Menu.tsx` | 7 barras marfil (`scaleY 0→1`, 0.5 s `power3.inOut`, `stagger 0.045`), video del laboratorio muy desenfocado de fondo (`blur-[42px] saturate-[.7] opacity-60`), enlaces `clamp(3.25rem,10.5vw,9.5rem)` con `overflow-hidden` y `yPercent 60→0` `stagger 0.06`. **Hover: los demás enlaces `opacity .35` + `blur(7px)`** vía `group-has-[a:hover]` en CSS puro, 500 ms. Al elegir un enlace primero se cierra el menú y *luego* se hace `desplazarA(destino, 1.3)` con Lenis. |
| **Megamenú con tarjetas de imagen (sin burger en escritorio)** | C `navegacion\Barra.tsx` | Ver B2. En móvil, la etiqueta dorada abre una hoja con las mismas tarjetas. |

**Por qué funciona:** el menú no es una lista; es un *evento* con origen físico (el botón), identidad (personajes, video, tarjetas) y respuesta al puntero (preview, desenfoque).

### B4. Hero

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Wordmark gigante + personajes con doble parallax** | G `secciones\hero-fungo.tsx`, `use-hero.ts` | Wordmark en Wobbly girado, tres capas con `data-raton="n"` (parallax de ratón con `quickTo` 0.9 s `power3.out`) y `data-capa` (scrub al scroll); el wordmark crece y deriva al salir (`crecerWordmark`, `scale` + `xPercent`). La entrada se crea **pausada** y se dispara con el evento de fin de telón; los elementos llevan clase CSS `.entrada-oculta` y `fromTo` fija el estado final. Esporas flotantes y estrellas de cuatro puntas (`adornos.tsx`) como decoración. |
| **Titular escalonado con video dentro de la palabra + 3D detrás** | I `inicio\Hero.tsx` | Cuatro líneas con máscara (`overflow-hidden`, `yPercent 110→0`, 1.1 s `power4.out`, `stagger 0.09`), cada línea con sangría distinta; en "Prototipos" un `<video>` de impresora de `0.74em × 1.9em` (`scaleX 0→1`, origen izquierdo) que se agranda y muestra un play al pasar el ratón. Marginalia en las esquinas ("3D | PCB | Robótica", "Laboratorio de prototipado Popayán, Cauca"). Bombillo en partículas con bloom detrás; **mantener pulsado el hero lo hace estallar** (`data-zona-explosion`, cursor muestra "MANTÉN"). Guion naranja y punto final en color como acento tipográfico. |
| **Video a pantalla completa con las letras como ventana** | C `secciones\Banner.tsx` (`Portada`) | Sección `h-[230svh]` con contenido `sticky`. Video oscurecido; las letras son capa con `mix-blend-mode: multiply`. `scrub` 0.8: "CAFÉ DE" `yPercent -160` y se desvanece; `letras` `scale 1→38` con `transformOrigin` en el centro de la "O" (calculado con `offsetLeft/offsetTop` para que sea correcto aunque se cargue a mitad de scroll); video `scale 1.12→1`. Parallax de ratón con `quickTo` (`lx`, `ly`, `vx`). Capítulos numerados que cambian el video con fundido de 1.2 s y barra de progreso. |

**Por qué funciona:** el hero tiene una *acción posible* (arrastrar, mantener, scrollear para entrar) y un objeto con volumen/personalidad, no solo titular + foto + CTA.

### B5. Secciones y transiciones entre secciones

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Motor de escena declarativo** | G `secciones\use-escena.ts` | Atributos de datos: `data-capa="v"` (parallax con scrub, v>0 sube más rápido, v<0 se rezaga; `data-capa-x`, `data-capa-giro`), `data-rev="variante"` (siete entradas: `subir y:70`, `izq x:-140 rot:-5`, `der`, `zoom scale .55 'salto'`, `clip inset(0 100% 0 0)→0 'tiza'`, `giro rot:-14 scale .7 'goma'`, `caer`), `data-titular="palabras|lineas"` (SplitText con `autoSplit`), `data-contar`, `data-barra`. Se puede componer una sección sin escribir GSAP. |
| **Persiana: el marquee gigante se "cierra" y entrega a la sección de color** | I `inicio\Persiana.tsx` | Sección `h-[220svh]` con contenido sticky; marquee "IDEA ✦ DISEÑO ✦ FABRICACIÓN ✦ PRUEBA" con ícono propio tras cada palabra (`xPercent 0 → -35`, `scrub 0.6`); 9 barras marfil con `scaleY 0→1`, `stagger {each:0.04, from:'random'}`, origen alternado arriba/abajo, y **cada barra lleva `data-tema="marfil"`** para que el navbar cambie de color cuando la cubren (`inventia\1440-02-scroll-2.png`). |
| **Pista horizontal pinneada con el scroll vertical** | I `inicio\EnCorto.tsx`; G `secciones\use-proceso-horizontal.ts`, `proceso-resumen.tsx` | Inventia: sección de altura = recorrido horizontal + 1 pantalla, contenido `sticky` (sin pin-spacer), `scrub 0.8`, elementos que suben suaves al entrar por la derecha, y la pista **termina en un panel naranja que es el comienzo de la sección siguiente**. Genix: siete tarjetas de cómic en tira horizontal; una mascota camina por un camino SVG siguiendo `getPointAtLength` y las piernas siguen la misma fase; cada tarjeta entra al cruzar el borde derecho con `{y:110, rotate:8, scale:.9, opacity:0}`. |
| **Pila de tarjetas de video + taza que se llena** | C `secciones\Ciclo.tsx` | Cuatro tarjetas de video apiladas con `position: sticky`; cada una tapa a la anterior, que se encoge y oscurece; una línea discontinua se traza con el scroll y una taza fija se llena de café con ola mientras avanza. |
| **Mata que crece con el scroll** | C `secciones\Impacto.tsx` | Tallo dibujado de abajo arriba con DrawSVG, una luciérnaga dorada lo recorre con MotionPath, en cada nudo brota una hoja y su eslabón entra desde ese lado, las cerezas pasan de verde a rojo; parallax de tres capas; la mata se mece con viento. Solo `transform/opacity/clip-path`, sin pin. |
| **Marquee ligado a la velocidad de scroll** | G `secciones\use-transformacion.ts` (`animarMarquee`), `transformacion-fungo.tsx` | El bucle avanza siempre; la velocidad de Lenis lo acelera y el sentido sigue al del scroll; el impulso decae por fotograma, solo mientras la sección es visible. Dos filas (una rellena amarilla, otra solo contorno `marquee-contorno`) y un blob SVG que muta con MorphSVG entre 3 formas (3.4 s `sine.inOut`) con las ilustraciones recortadas dentro. |
| **Hover que desenfoca al resto + imagen que se abre en triángulo** | I `inicio\Servicios.tsx` | Servicios en tipografía gigante centrada; `group-has-[li:hover]` pone `opacity .3 + blur(6px)` al resto; aparece su ícono (`scale .5 -rotate-45 → 1 0`) y su descripción al lado; en la esquina inferior una imagen se despliega con `clip-path` poligonal (`expo.out` 0.85–1.05 s al abrir, `power3.in` 0.45–0.55 al cerrar, imagen interna `scale 1.25→1`). |
| **Lista que se recorre sola, como historias** | I `inicio\ParaQuien.tsx` | Cuatro públicos (Emprendedores/Estudiantes/Investigadores/Empresas) en tipografía gigante; barra de progreso por ítem, avance automático o por hover; la imagen cambia con barrido diagonal sobre fondo naranja pleno con patrón de infinitos (`inventia\1440-02-scroll-6.png`). |
| **Selector de pantalla partida (estilo GTA V)** | G `selector\selector-marcas.tsx`, `animaciones-selector.ts` | Pantalla dividida en diagonal; el lado bajo el puntero se expande a ~62 %, su personaje posa y el otro se oscurece; parallax por ratón con `data-par`; intro de "pantalla VS" con paneles desde lados opuestos y destello en la diagonal. |
| **Borde ondulado de color entre secciones** | G (visible en `genix\1440-02-scroll-1.png`, `-06.png`) | Las secciones no terminan en línea recta: una onda del color de la siguiente sección sube sobre la anterior. |

### B6. Tarjetas e imágenes

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Tarjetas de cómic inclinadas con número gigante** | G `secciones\proceso-escenas.tsx` | Marco grueso crema con sombra dura de color, ilustración con halftone, número `03` enorme en lima con contorno que sobresale del borde, rotación individual (`genix\1440-02-scroll-3.png`). |
| **Paneles con inclinación 3D y confeti** | G `secciones\beneficios-paneles.tsx`, `use-paneles.ts` (`inclinar`, `lanzarChispas`) | `[data-inclinar]` gira hacia el cursor (`transformPerspective 900`) y el hijo `[data-inclinar-capa]` se desplaza en sentido contrario (profundidad); clic en el personaje lanza confeti con física, nodos creados fuera de React con temporizador de retiro. |
| **Polaroids con profundidad desigual** | C `secciones\Pitalito.tsx` | Fotos con marco crema, giradas, que llegan girando y luego siguen al ratón con factores de profundidad distintos (`quickTo` por eje); arcos SVG que se dibujan al entrar (`cafetal\1440-02-scroll-1.png`). |
| **Carrusel de cajas recortadas + vitrina** | C `secciones\Portada.tsx` (carrusel), `secciones\SalonFama.tsx` | Tarjetas de color plano con el producto recortado que se levanta y gira al hover (nombre debajo); la cinta frena al pasar el ratón y acelera/inclina con el scroll. Vitrina: la caja activa cae sobre un pedestal, la luz parpadea y toma el color del sabor, polvo dorado (`ui\Polvo.tsx`, canvas 2D) que se aparta del cursor (`cafetal\1440-02-scroll-5.png`). |
| **Foto con revelado tipo máscara de clip** | G `use-escena.ts` variante `clip`; C `ui\Movimiento.tsx` | `clip-path: inset(0 100% 0 0)→inset(0)`; en Cafetal la imagen interior "se asienta" desde una escala mayor. Revelado simple con IntersectionObserver (80 ms de escalonado entre título, texto e imagen). |
| **Protagonista 3D con estado** | C `tres\Taza3D.tsx`, `tres\Momentos3D.tsx`, `secciones\TuTaza.tsx` | Three.js cargado con `import()` al acercarse (ADR-0002), póster SVG como respaldo sin WebGL o con movimiento reducido; "Arma tu taza" es un juego: elegir sabor tiñe la sección con el color de su caja, hace caer su nombre gigante letra a letra, trae la caja y lanza sus ingredientes (Physics2D); infusionar salpica; taza lista llueve granos (`cafetal\1440-02-scroll-3.png`). |
| **Escena 3D que acompaña el scroll** | I `escena\Escena.tsx`, `motor.ts`, `modelo.ts`, `control.ts` | Un único canvas fijo compartido por loader, hero y scroll. Estado compartido `control` (posición, `explosion` 0–1, `formacion`, `materializacion`, `escaneo`) escrito con GSAP desde cada sección y leído por el motor en cada fotograma (suaviza hacia el objetivo). Shaders propios, `UnrealBloomPass`, estrellas que titilan y fugaces en `espacio.ts`. |

### B7. Botones, hover y micro-interacciones

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Botón de juego** | G `secciones\secciones.css` `.boton-juego` | Píldora con `border: 4px` + `box-shadow: 5px 5px 0` del color de la tinta; hover `translate(-2px,-4px) rotate(-1.5deg)` y sombra `8px 9px`; active `translate(4px,4px)` y sombra `1px`; `ease-salto` (`cubic-bezier(.34,1.56,.64,1)`, rebasa). Cuatro variantes de color; en móvil `text-wrap: balance`. |
| **Botón editorial: línea que cambia de color y flecha que se desplaza** | I `app\globals.css` `.accion` | Texto en mayúsculas con subrayado hecho con `background-size`, flecha `::after`; hover pinta línea y texto de naranja y la flecha avanza 6 px (`--ease-salida`). Sin caja, sin sombra. |
| **Botón píldora con círculo-flecha** | C `ui` (ver capturas) | Píldora crema con círculo oscuro con flecha a la derecha; en el footer, filas `rounded-[18px]` que al hover se pintan de dorado y la flecha gira −35° con rebote. |
| **Magnéticos** | I `sistema\Cursor.tsx` | Los botones se dejan atraer hacia el puntero y vuelven con `elastic.out(1, 0.45)` en 0.6 s. |
| **Letras que se apartan del cursor** | I `pie\WordmarkReactivo.tsx`; G `pie\wordmark-reactivo.tsx` | Wordmark gigante, letra por letra; `quickTo` por letra en x, y y rotación (0.6–0.7 s `power3.out`) con `RADIO = 260`, `EMPUJE = 34`, `GIRO = 18` y falloff `(1 − d/R)^1.5`; centros medidos al entrar el puntero, no en cada movimiento; en táctil un toque hace saltar las letras en onda. |
| **Íconos que se imprimen / hongos que brotan** | I `pie\TallerPie.tsx`; G `pie\jardin-pie.tsx` | Al pasar el ratón por la franja inferior brotan hongos (Genix) o se "imprimen" íconos capa a capa (Inventia) cada 90 px, máximo 12; al hacer clic, chispas o esporas con gravedad. Nodos efímeros fuera de React con varias vías de retiro. |
| **Pupilas y parpadeo** | G `secciones\mascota-interactiva.tsx` | Pupilas que siguen al cursor (`quickTo`), parpadeo con `delayedCall(random(2.4, 5.6))` saltado fuera de pantalla, respiración del cuerpo pausada con la visibilidad. Las mascotas están vivas aunque nadie las toque. |

### B8. Cursor

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Cursor mascota con estados** | G `cursor\cursor-motor.ts`, `cursor-estado.ts`, `cursor-eventos.ts`, `cursor-mascota.tsx`, `grano-cafe.tsx` | Un único ticker de GSAP, dos `quickTo` (seguimiento) y dos `quickSetter` (punto exacto); nada pasa por React. Estados: *idle* (>2.5 s quieto baila en bucle), *moving* (se inclina y hace squash & stretch según velocidad; piernas que caminan), *hover* sobre interactivos (se agranda, ojos sorprendidos, saluda), *press* (se aplasta). En `/coffee` se vuelve un grano de café. Solo `pointer: fine`, nunca oculta el cursor nativo en inputs. Fallo medido: sobre fondo verde la mascota blanca con trazo verde desaparece → contorno con 4 `drop-shadow` encadenados. |
| **Punto + anillo con etiqueta contextual** | I `sistema\Cursor.tsx` | Punto naranja exacto + anillo con inercia (`quickTo` 0.45 s `power3.out`); crece a 1.7 sobre enlaces y a 2.6 con texto donde hay `[data-cursor="Ver video"]` o la zona de explosión del hero ("MANTÉN"); el punto desaparece y el anillo lleva el texto; clic reduce la escala. |
| **Grano que se vuelve taza** | C `ui\CursorGrano.tsx` | Grano dorado que persigue al puntero, gira hacia donde va (`atan2`), se estira con la velocidad (`scaleY 1 + min(.6, v·.35)`), sobre `a, button, [role=tab]` se convierte en taza con vapor, al clic suelta 7 granitos (`explosion`). Conserva el cursor del sistema. |

### B9. Footer

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Pantalla de cine + wordmark reactivo + jardín** | G `pie\pie-pagina.tsx`, `pantalla-tv.tsx`, `wordmark-reactivo.tsx`, `jardin-pie.tsx`, `boton-subir.tsx`, `vuelo-subir.ts` | Footer de alto ≥ viewport, video dentro de una tele de dibujos (contorno crema grueso, sombra de puntos, antenas que se agitan, mandos de adorno), titular "Siéntete *bien* con lo que comes", wordmark gigante que reacciona al cursor, franja de jardín al pie. **Botón de subir:** un hongo agarrado a globos de colores (5.5 rem, pegatina crema para legibilidad); al pulsar, el clon despega, la página sube con Lenis (duración según distancia) con estela de esporas (`genix\1440-02-scroll-6.png`). |
| **Logo vivo + filas de acción** | C `secciones\Pie.tsx`, `marca\LogoVivo.tsx` | Titular `clamp(5rem, 15vw, 15rem)` "¿Un café?" y filas-botón "Quiero ser distribuidor…"; logo gigante que se dibuja (casa de 550 segmentos con DrawSVG), letras que caen, humo de chimenea y letras que se levantan con el cursor; créditos "Creado por Fábrica de Software · Powered by EmprendeLab". Botón de subir `navegacion\BotonArriba.tsx`: taza dorada con anillo de progreso que estalla en granos y gotas (Physics2D), despega y al llegar arriba cae una segunda salpicadura desde la barra. |
| **Capas de impresión como borde + pantalla del lab** | I `inicio\Cierre.tsx`, `pie\PantallaLab.tsx`, `pie\TallerPie.tsx`, `pie\WordmarkReactivo.tsx`, `sistema\BotonArriba.tsx` | Tres líneas de 3 px con opacidades .35/.6/1 como borde superior (las "capas" de impresión, `data-capa-borde`), titular, video del laboratorio en marco con cruces y etiqueta "LAB 01" que se carga al acercarse (`rootMargin 300px`) y abre a pantalla completa con sonido, wordmark reactivo, columnas de enlaces con `pie-enlace`. |

**Por qué funciona:** el footer es el último acto, con su propio juguete interactivo; el botón de subir es una pieza de personalidad, no un `↑`.

### B10. Transiciones entre páginas

| Patrón | Dónde | Qué hace |
|---|---|---|
| **Telón con borde de lóbulos + mascota que cruza** | G `transicion\telon-transicion.tsx`, `capa-pagina.tsx`, `capa-fungo.tsx`, `capa-coffee.tsx`, `telon-formas.tsx`; `shared\ui\movimiento\transicion-contexto.tsx` | Tres telones (`fungo`, `coffee`, `pagina`) + fundido de 250 ms para movimiento reducido. `cubrir` bloquea el scroll (Lenis `detener`), anuncia el destino en región `aria-live` ("Yendo a Fungo Genix"), construye la timeline y espera una promesa que **siempre** se resuelve (completa, interrumpida o temporizador `duración + 1 s`); se navega con el telón cubriendo; `descubrir` lo retira cuando la ruta pintó. Seguridad 15 s. Visible en `genix\1440-07-transicion-pagina.png`: borde de lóbulos de color sólido barriendo y la mascota en el centro. |
| **Interruptor de palanca con física** | G `transicion\interruptor-marca.tsx`, `particulas-interruptor.ts`, `capa-coffee.tsx` | Palanca vertical fija a la derecha, a media altura, con colores por tema de sección; en móvil se tumba en píldora 106×44 px abajo a la derecha y se esconde mientras hay scroll. Cambiar a Coffee hace llover granos con física; a Fungo, brotan hongos y esporas. |
| **Ola de café** | C `lib\transicion.ts` (`transicionar`) | Capa fija creada por JS: una ola SVG animada por CSS (`@keyframes ola`) y un bloque `#5a3b26` con "Sirviendo…" en titular gigante; sube `yPercent 105→0` en 0.65 s `power3.inOut`, se navega, y al llegar el evento `EVENTO_RUTA` sale `yPercent -110` en 0.8 s. Seguridad 2.5 s. |
| **Persiana de barras** | I `sistema\Menu.tsx` | Usada también para abrir el menú; mismo vocabulario que la persiana del scroll. |

### B11. Estados, accesibilidad y robustez (las piezas que no se ven pero sostienen todo)

- **Salida garantizada** en todo lo que cubre la pantalla: Genix 9 s (loader), 15 s (telón), 2.5 s (menú); Inventia 10 s (`RETIRO_FORZADO`); Cafetal 8 s; ver estándar `Animación y Movimiento`.
- **Reduced motion** con versión propia, no solo "apagado": Genix loader reducido (cartel con fundido), telones como fundido de 250 ms, cursor nativo; Inventia persiana con `scaleY:1` fija; Cafetal solo sube sin explosión.
- **Estado inicial en CSS** (`.entrada-oculta`, `[data-entra] { opacity:0 }` bajo `html:not([data-intro="fin"])`, script inline que decide `data-intro`) para no ver destellos de SSR.
- **Contraste auditado:** Genix registró y corrigió fallos AA sobre verde (ADR-0004); el naranja de Inventia solo ≥ 44 px sobre claro, `--naranja-texto: #b8470f` para texto pequeño.
- **Medición sistemática:** Genix `docs\03 - Decisiones\Fallos medidos.md` (solapes de texto con rectángulos de `Range`, FPS con CPU ×4, `Page.startScreencast` para fotogramas intermedios). Aprendizaje transferible: *cualquier elemento fijo sobre el borde derecho tapa texto en móvil*; probar a 5 anchos.

---

## C. Diagnóstico de ProInserco actual

Comparado con `capturas-finales\` (hero, "qué hacemos", menú, loader, panel claro, panel móvil). ProInserco no está roto: está **correcto y genérico**, que para este cliente es el peor veredicto.

| Pieza | Qué se ve | Por qué se siente "IA/sencillo" frente a las referencias |
|---|---|---|
| **Loader** (`1440-00-loader.png`) | Logo "P" centrado sobre crema liso con una raya verde abajo. | Es el patrón "logo + barra". No cuenta nada, no tiene texto con voz, no hay objeto que viaje, no hay remate que *desvele* la página (Cafetal inunda la pantalla de café y sube; Genix abre un telón de dos paneles; Inventia termina en destello). El logo de flecha circular verde, que es un objeto con dirección y volumen, está estático. |
| **Navbar** | Píldora crema flotante con logo, 6 enlaces en texto y botón negro "Donar" + burger. | Es el navbar de cualquier SaaS. Todos los enlaces con el mismo peso; ningún elemento girado ni con carácter; no cambia de forma al llegar al footer en lo visible; el botón Donar es negro con corazón (cliché). Seis enlaces *y* un burger a la vez es redundancia sin intención. Genix y Cafetal reducen a pegatinas/píldoras con personalidad y Inventia a dos acciones. |
| **Menú a pantalla completa** (`1440-05-menu`) | Fondo bosque liso, 6 enlaces grandes alineados a la izquierda con un `01`… minúsculo, teléfono y dirección, botón lima, ornamento topográfico casi invisible. | **Es una lista.** Sin barrido de apertura con origen físico, sin preview al pasar el ratón, sin desenfoque de los demás, sin objeto de la marca asomándose, mitad derecha vacía. Los numeritos `01..06` pegados a la baseline son decoración de plantilla. Los tres menús de referencia son un evento (círculos desde el botón, persiana de barras, tarjetas con foto). |
| **Hero** (`1440-02-inicio-hero`) | Foto de montaña con degradado oscuro, **píldora-eyebrow con puntito** ("Fundación caucana · 22 años en territorio"), titular grande en Bricolage a la izquierda, párrafo, botón contorno "Conócenos ↓", tarjeta rotada "APORTE RÁPIDO" abajo a la derecha. | Es la fórmula: eyebrow + H1 + párrafo + botón fantasma + tarjeta flotante + degradado sobre foto. El titular es una sola línea de texto del mismo peso, sin escala contrastada, sin palabra que cambie de fuente o color, sin imagen *dentro* del texto. La foto de fondo tiene el velo oscuro que mata el color del Cauca que es el activo. La tarjeta de donación rotada ~3° es el único gesto y compite con el titular. Sin acción posible en el hero (nada responde al ratón). Cafetal y Genix tienen *una cosa con la que jugar* en la primera pantalla. |
| **Qué hacemos** (`1440-03`) | Fondo bosque liso, eyebrow "/ Lo que hacemos todos los días", titular centrado, dos tarjetas rotadas (terracota y sol) con número `01.`/`02.` y texto. | Tarjetas de color rotadas con número y título corto son un patrón reconocible de plantilla; aquí además no contienen *nada*: sin ilustración, sin foto, sin dato, sin comportamiento. Las tarjetas tapan parte del titular (`Qué`, `hacemos`) de forma que parece accidente. Líneas topográficas apenas perceptibles: decoración de relleno. Genix hace tarjetas de cómic con ilustración, número gigante lima desbordando el marco y sombra dura; aquí hay solo un rectángulo coloreado. |
| **Estructura de secciones** | Todas con eyebrow (`etiqueta-seccion`) + título + contenido (ver `secciones-*.tsx`: "Aliados", "Lo que no negociamos", "Las personas detrás", "El paso que cambia todo", "Contacto", "De la idea al informe final", "Aprender en el territorio", "Dónde trabajamos"). | Misma estructura en 8 secciones: etiqueta pequeña encima, título, contenido. El ritmo es monótono; ninguna sección cambia de formato (pista horizontal, pila de tarjetas, marquee, split de pantalla). Prohibido ya por el usuario. |
| **Color** | Bosque, crema, terracota y sol aplicados con timidez; lima solo en CTAs. | Hay una paleta rica y se usa como "fondo oscuro verde / fondo crema". No hay planos de color a pantalla completa con transiciones (onda, persiana, ola), no hay un acento tipográfico (el punto naranja de Inventia, el guion). |
| **Tipografía** | Bricolage Grotesque + Instrument Sans autoalojadas. | Una sola familia con peso 700-800 para todo. Bricolage es buena, pero ya es *la* fuente "de moda" de las webs generadas; usada sola y sin mezcla se lee como template. Faltan: serif cálida para énfasis, tipografía condensada o display para el titular gigante, mezcla de tamaños dentro de una frase. |
| **Panel (claro y móvil)** (`1440-11`, `390-12`) | Sidebar con fondo verde pálido, tarjetas blancas de KPI con delta en píldora roja, barras verdes iguales, filtros en píldoras, fecha `dd/mm/aaaa` nativa. | Es un admin de librería de componentes: tarjetas blancas uniformes con sombra, píldora de delta, barras sin carácter, etiquetas en versalitas encima de los campos, **fechas en input nativo** y fechas en lista sin diseño, filtros-píldora que ocupan media pantalla en móvil. Nada recuerda la marca (el verde del logo está solo en el avatar y la barra). Estados (aprobada/pendiente/rechazada) como texto/píldora genérica. |
| **Movimiento** | Hay SplitText, scrub, pin y mapa; todo con `EASE.expoSalida` y el mismo patrón de entrada (`y: 28 → 0`, `stagger .08`). | La infraestructura es buena pero el **vocabulario de movimiento es uno solo**: subir y aparecer. Sin cursor propio, sin parallax de ratón, sin magnéticos, sin objeto interactivo, sin transición de página, sin pieza firma, sin sonido/rastro al clic. Las tres referencias tienen 8-12 vocabularios distintos. |
| **Humor/voz** | Textos institucionales. | "Al servicio de la comunidad", "Súmate en un clic". Cero personalidad en los textos de sistema (carga, vacíos, errores, botones). |

**Resumen del diagnóstico:** ProInserco ejecuta bien las *convenciones* del sitio institucional moderno (píldora, eyebrow, tarjetas rotadas, degradado sobre foto, Bricolage, scroll suave). Las referencias no ejecutan convenciones: inventan reglas de un mundo y las repiten.

---

## D. Anti-patrones "IA genérico" (prohibidos)

**Ya prohibidos por el usuario**
1. Etiqueta/subtítulo pequeño encima de los títulos (eyebrows): "Fundación caucana · 22 años en territorio", "/ Lo que hacemos todos los días", "APORTE RÁPIDO", "DONAR". *Matiz medido en las referencias:* Inventia usa `etiqueta` pero como **marginalia en las esquinas** del layout (nunca encima del titular); Genix usa **pegatinas giradas** con personalidad ("De la semilla a la mesa") que son un objeto más. Para ProInserco: ninguna etiqueta encima del titular; si hace falta contexto, va en el margen o dentro de la frase.
2. Menú burger que es una simple lista.
3. Fechas y datos sin diseño propio en el panel.
4. Todo "sencillo".

**Detectados**
5. Píldora con puntito de color ("● Fundación caucana…") y píldoras-chip de estado idénticas.
6. Tarjetas uniformes en rejilla (3 o 4 iguales con ícono, título, texto). Si hay varias tarjetas, tienen tamaños, rotaciones, comportamientos o ilustraciones distintas.
7. Degradado oscuro sobre foto con texto centrado o alineado a la izquierda como solución a la legibilidad. Sustituir por: foto sin velo con el texto *en máscara* (mix-blend), foto recortada en forma, o bloque de color sólido.
8. Íconos de línea genéricos (Lucide/Heroicons) como ilustración de conceptos. Sustituir por ilustración propia, recortes de fotografía, la flecha circular de la marca o glifos dibujados.
9. Secciones todas con la misma estructura (etiqueta + título + párrafo + cuadrícula). Cada sección cambia de formato.
10. Tarjeta flotante "glass" rotada 2-3° con CTA como único gesto del hero.
11. Botón fantasma con borde fino + flecha ("Conócenos ↓") como CTA secundario.
12. Botón negro/oscuro con corazón para "Donar". El acto de donar es el clímax del sitio y necesita su propia pieza (ver E).
13. Título del mismo peso y tamaño en toda la página; una sola familia tipográfica.
14. Entrada única "sube 24-28 px y aparece" aplicada a todo. Mínimo cinco entradas distintas rotadas por sección.
15. Numeración `01.` `02.` pequeña como decoración sin función.
16. Líneas topográficas/patrones al 5 % de opacidad como relleno de fondo. Si el territorio es motivo, es protagonista (recortado, a gran escala, con comportamiento) o no está.
17. Gráficos de barras todas iguales en verde con ejes de rejilla fina y KPI en cajas blancas idénticas con delta en píldora.
18. Loader de logo centrado + barra.
19. Footer de columnas de enlaces sobre fondo oscuro sin objeto interactivo.
20. Cursor del sistema sin respuesta a nada; ausencia de feedback al clic.
21. Copy institucional neutro en textos de sistema (cargando, vacío, error, éxito).
22. Hover que solo cambia color/opacidad.
23. Estado "vacío" con ilustración genérica y "No hay datos".
24. Fotos de banco o Pexels como protagonistas del hero cuando el cliente tiene fotos propias (`material\fotos-wix`, `equipo`). Foto real tratada > foto de stock bonita.

---

## E. Propuesta concreta para ProInserco

Concepto-mundo propuesto (equivalente al "juego" de Genix, al "laboratorio" de Inventia y a la "taza" de Cafetal): **el sitio es un recorrido de ida y vuelta por el territorio, y la flecha circular verde es el objeto que lo recorre.** El logo ya es una flecha que gira y vuelve (ciclo, retorno, reinversión social): se convierte en *el hilo* (loader, cursor, indicador de scroll, botón de subir, transición, firma del panel). La metáfora central es **"dar la vuelta"**: lo que se siembra vuelve en forma de comunidad. Todo lo demás se subordina: la paleta crema/bosque/lima/terracota/sol se usa como **planos de color a pantalla completa con transiciones físicas**, no como fondos tímidos.

Tipografía propuesta (a decidir con el cliente): titular gigante en una condensada o display con carácter (no Bricolage solo), serif cálida itálica para la palabra pequeña de énfasis entre palabras enormes (recurso de Cafetal), y Bricolage/Instrument Sans reservadas para texto de lectura y UI. Escala `--text-mega: clamp(4rem, 11vw, 11rem)` con interlineado 0.86 y tracking negativo.

### E1. Loader — "La flecha que cierra el círculo"
Base: Inventia `Loader.tsx` (trazo + chispa + progreso con destellos) + Genix (el progreso es un objeto que viaja) + Cafetal (frases con voz).
- La flecha circular se **dibuja con DrawSVG** (el aro, luego la cabeza de flecha, luego la "P" vertical) mientras una chispa lima recorre el trazo con `getPointAtLength`, soltando semillas/hojitas que caen.
- Contador 000→100 en `tabular-nums` abajo a la derecha, gigante, con **frases del territorio** por tramos: "Subiendo a la vereda…", "Cargando el tinto…", "Llegando a la reunión…", "¡Aquí estamos!" (tono cercano caucano, validar con el cliente).
- Remate: al 100 la flecha **gira una vuelta completa** (el "dar la vuelta") y su aro crece hasta llenar la pantalla en lima, que se corta con un `clip-path` circular desde el centro revelando el sitio (bosque → hero). La entrada del hero empieza cuando el aro empieza a abrirse.
- Una sola vez por visita, botón "Saltar", seguridad 8 s, versión reducida de 300 ms.

### E2. Navbar — "Pegatinas y una flecha que marca la sección"
Base: Genix pegatinas + Inventia navbar que lee lo que tiene debajo.
- Quitar los 6 enlaces en fila. Dejar: logo (a la izquierda, cambia de versión por fondo con fundido de 500 ms), una **píldora girada 2° con la sección actual** ("Qué hacemos") cuyo texto se cambia con SplitText al cruzar de sección, y el **burger** como círculo de la marca. "Donar" deja de ser un botón del navbar: pasa a ser un **aro lima que respira** pegado al borde (pieza E7).
- La flecha circular pequeña en el navbar **gira proporcional al progreso de scroll** (0→360° en toda la página) y vuelve a empezar: indicador de avance con identidad.
- Temas por sección vía lectura de `elementsFromPoint` (ya existe `data-seccion-tema`; añadir la lectura por punto como Inventia para cubrir barras/paneles internos).
- Al llegar al footer, la fusión en marco que ya existe se acentúa con el bisel de Genix (barras que crecen con `scaleX/Y`).

### E3. Menú — "Círculos de color desde el aro"
Base: Genix `menu-completo.tsx` (`construirApertura`).
- Tres capas de `clip-path: circle(0 at origen)` en bosque, lima y crema; origen = centro del burger medido en px con desvíos (−36,18 / 28,−14 / 0,0), 0.9 s con curva simétrica firme, escalonadas 0.12 s. El burger es la flecha circular y se funde en una X girando.
- Enlaces gigantes (`clamp(3.5rem, 9vw, 9rem)`) con `SplitText chars + mask`, `yPercent 115, rotation 8`, `stagger .022`.
- **Preview al pasar el ratón**: una foto recortada del territorio (de `material\fotos-wix`/`equipo`) enmarcada, rotada, que sigue al cursor con `quickTo` y se intercambia con rebote; "Quiénes somos" muestra rostros del equipo; "Territorio" un fragmento de ladera; "Capacitaciones" una mano con café.
- Los demás enlaces se desenfocan (`group-has-[a:hover]`, `blur(7px) opacity .35`, 500 ms).
- Elemento de la marca asomándose por el borde: la flecha circular gigante recortada, rodando lentamente desde abajo a la derecha.
- Pie del menú: teléfono y dirección con subrayado grueso (como Genix), "Donar" como el aro lima de E7. Esc, foco atrapado, scroll detenido.
- Móvil: lista a pantalla completa con la misma apertura circular; sin preview.

### E4. Hero — "La frase que se abre como una ventana"
Base: Cafetal `Banner.tsx` (letras como ventana + entrada por una letra) + Inventia (video/foto dentro de la palabra, marginalia).
- Titular en tres a cuatro líneas, escala brutal, con sangría distinta por línea. La palabra clave ("comunidad") **es una ventana a la foto/video del Cauca a plena luz** (`mix-blend-mode: multiply` sobre capa oscurecida), mientras el resto de la foto va oscurecida al ~45 %. En una línea, una palabra pequeña en serif itálica ("al servicio *de*") entre palabras enormes.
- **Al hacer scroll la cámara entra por una letra** (la "O" de "comunidad"): `scale 1→38` con `transformOrigin` calculado desde `offsetLeft/offsetTop`, sección `h-[230svh]` con contenido sticky, `scrub 0.8` — y esa entrada desemboca en la siguiente sección de color (bosque).
- Dentro de una palabra, un clip corto en bucle (0.74em × 1.9em) como el de "PROTOTIPOS": una mano en el cafetal.
- Marginalia en las esquinas: "Popayán, Cauca" a la izquierda; a la derecha la cifra (22 años) con diseño de dato (E5/E6). Sin eyebrow encima del titular.
- Acción posible: **parallax de ratón por capas** (`quickTo`) y el cursor (E10) cambia a "Entra" sobre la ventana.
- Quitar degradado oscuro, píldora con puntito, botón fantasma y tarjeta "aporte rápido" (esta última se resuelve en E7).

### E5. Qué hacemos — "Tres frentes, tres formatos"
Base: Inventia `Servicios.tsx` + Genix tarjetas de cómic + persiana.
- Lista gigante de las líneas de trabajo (Elaboración y diseño de proyectos, Impulso, …) en tipografía de 8-10 vw centrada. Al pasar el ratón: las demás se desenfocan, el ícono propio (dibujado, no Lucide) gira de −45° a 0 con rebote, y en una esquina se despliega una foto en **clip-path poligonal** (triángulo/hoja) con `expo.out`, imagen interna `scale 1.25→1`.
- Entrada por **persiana de barras bosque→terracota** con `data-tema` por barra para que el navbar cambie, como `Persiana.tsx`.
- Móvil: tarjetas apiladas con `sticky` (como `Ciclo.tsx`), cada una tapa a la anterior encogiéndola; sin hover.
- Los datos (número de proyectos, familias) como contadores con `data-contar` y barra, tipográficamente enormes, no en tarjetas.

### E6. Territorio — "El mapa que se recorre"
Base: Genix `use-proceso-horizontal.ts` (mascota que camina por un camino) + Cafetal `Impacto.tsx` (mata que crece, DrawSVG + MotionPath).
- Pista horizontal pinneada con el scroll vertical: el mapa del Cauca como forma SVG de gran escala; **la flecha circular recorre la ruta** (`getPointAtLength`) entre municipios y en cada parada se abre una ventana con foto, nombre en titular gigante y un dato (población atendida, año), con entradas distintas (`clip`, `giro`, `caer`).
- La ruta se dibuja con DrawSVG y el recorrido termina en un panel de color pleno (terracota) que es el comienzo de la sección siguiente.
- Parallax de tres capas con relieve del paisaje (cordilleras recortadas) que derivan con el scroll.
- Móvil: lista vertical con la ruta como línea que se traza y paradas que brotan.

### E7. Llamado a donar — "El aro que se llena"
Base: Cafetal `TuTaza.tsx` (juego: elegir tiñe la sección, el nombre cae letra a letra, lluvia al completar) + Genix `.boton-juego` (sombra dura).
- Sección a pantalla completa en lima o sol. Los montos son **cuatro objetos** (no píldoras iguales): una semilla, una mata, un árbol… con tamaños y rotaciones distintas, `.boton-juego` con borde grueso y sombra dura (`translate(-2px,-4px) rotate(-1.5deg)` al hover, `translate(4px,4px)` al pulsar).
- Al elegir un monto, **el aro de la flecha se llena** con un líquido/verde con ola SVG hasta ese nivel, el monto cae gigante letra a letra y suena un pop opcional (con interruptor visible). Debajo se traduce a impacto humano ("$50.000 = una jornada de formación para 5 familias", validar cifras con el cliente).
- Al confirmar: lluvia de hojas/granos con gravedad (Physics2D) que termina en la flecha cerrando el círculo; con movimiento reducido solo fundido.
- En todo el sitio, "Donar" es un **aro lima fijo en el borde** (arriba derecha en escritorio; barra inferior en móvil) que respira con escala 1→1.04 (19 s y 23 s para desincronizar si hay dos). Sin corazón ni botón negro.

### E8. Equipo — "Retratos con vida"
Base: Genix `mascota-interactiva.tsx` + `equipo-perfiles.tsx` + Cafetal polaroids.
- Retratos reales en **polaroids giradas** (−6° a +5°) con profundidad desigual: siguen al cursor con `quickTo` (factores distintos por foto). Entrada con `giro`.
- Cada persona se puede abrir: la foto se agranda, el nombre aparece gigante letra a letra, un dato propio ("22 años recorriendo veredas"), y 2-3 "medidores" de personalidad/trayectoria al estilo Genix (`data-barra`). Hover: la foto pasa de blanco y negro/duotono bosque a color.
- Un detalle vivo: parpadeo sutil de un guiño en un rincón (la flecha) o un cartel en el fondo que se mece.
- Móvil: carrusel horizontal con snap y la foto activa de color.

### E9. Footer — "El último acto: la flecha y el territorio"
Base: Inventia `Cierre.tsx` (borde de capas, acople al navbar, wordmark reactivo) + Genix (pantalla de cine, botón de subir con personalidad) + Cafetal (logo vivo, créditos).
- Borde superior de **tres capas de color** (bosque 35 %, terracota 60 %, sol 100 %) que sube como curva ondulada.
- Titular gigante a medida de pantalla ("Sigamos dando la vuelta" o la frase aprobada) con las letras que se apartan del cursor (`RADIO 260`, `EMPUJE 34`, `GIRO 18`, falloff `^1.5`, `quickTo` por letra; en táctil, toque = onda).
- Pantalla de video del territorio en un marco con la forma de la marca (círculo con flecha), se carga al acercarse (`rootMargin 300px`) y abre a pantalla completa con sonido.
- Franja inferior interactiva: al pasar el ratón brotan **matas de café y hojas**; al clic, semillas con gravedad.
- Botón de subir: la flecha circular que despega girando 360° y deja estela de hojas; progreso del scroll como anillo (como `BotonArriba.tsx`).
- Créditos obligatorios: "Created by Fábrica de Software · Powered by EmprendeLab". Footer ≥ viewport; fusión con el navbar en marco.

### E10. Cursor y vocabulario transversal
- **Cursor**: un aro lima con inercia (`quickTo` 0.45 s `power3.out`) y punto exacto; sobre enlaces 1.7×; sobre elementos con `data-cursor` muestra texto ("Entra", "Donar", "Ver"); al clic suelta 5-7 semillas con gravedad; se aplasta al pulsar; solo `pointer: fine`, sin reduced motion, nunca en inputs.
- **Transición de página**: ola de color que sube con la flecha girando en el centro y texto con voz ("Regresando a la vereda…"); evento `ruta-lista` para descubrir; seguridad 2.5 s; fundido de 250 ms en reduced motion.
- **Entradas**: adoptar las siete variantes de Genix (`subir`, `izq`, `der`, `zoom`, `clip`, `giro`, `caer`) por atributos de datos y **rotarlas entre secciones contiguas**.
- **Sonido**: opcional, desactivado por defecto, con botón visible (Cafetal usa 6 efectos a −20 LUFS).
- **Mantener lo que ya está bien**: reduced motion por `matchMedia`, entrada inicial en CSS, `fromTo`, `quickTo`, Lenis sincronizado con el ticker, GSAP diferido, presupuesto alternativo con ADR (el sitio superará el JS general, como Genix en `ADR-0005`).

### E11. Panel de administración — carácter propio, sobriedad intacta
Regla: en el panel **el color y la tipografía llevan la marca; el movimiento es mínimo y funcional** (nada de cursor propio ni transiciones teatrales; sí micro-feedback y revelados cortos).
- **Fechas con diseño propio.** Una fecha deja de ser `16/11/2026` o un input nativo. Componente `Fecha`: día en tabular grande (28 px, condensada de la marca) apilado sobre mes en versalitas pequeñas (`NOV`) y año tenue, con un fondo-calendario tipo "pestaña de calendario" en crema con el borde superior en color de estado. En listas, la columna Fecha usa este bloque; en la ficha, la línea de tiempo vertical lleva las fechas como marcas sobre un eje con el aro de la flecha por hito. Selector de rango con **calendario propio** (día seleccionado en lima, rango en crema, hoy con aro), no `dd/mm/aaaa`.
- **Estados con identidad.** Un sistema de estados con forma además de color (accesible): *Aprobada* = aro cerrado verde con check; *Pendiente* = aro con un arco a medias (la flecha girando lento, 19 s, solo si está en pantalla); *Rechazada* = aro roto/abierto terracota; *Expirada* = aro tenue punteado; *Reembolsada* = flecha invertida; *Contracargo* = aro rojo con marca. Se usan igual en tabla, ficha, filtros y gráfica. Sustituye píldoras de texto idénticas.
- **Tablas.** Cabecera sticky en bosque 950 con tipografía de marca; filas con acento lateral por estado (3 px) en vez de cebra; monto en tabular grande alineado a la derecha con "$" en tono atenuado; hover de fila con desplazamiento 4 px y aparición de acciones; revelar datos enmascarados con un efecto de "desenfoque que se aclara" (`blur` → 0, 250 ms) en lugar de cambiar un texto de golpe.
- **Gráfica.** Barras con la **flecha circular** como motivo: el día de mayor recaudo marcado con el aro y su valor en tipografía grande; barras con esquinas superiores redondeadas y degradado de hoja a lima según el valor; línea de promedio punteada en terracota; tooltip con el bloque de fecha propio; se dibuja al entrar con `scaleY` escalonado 20 ms (origen inferior). Alternativa tabular accesible conservada ("Ver los datos en una tabla").
- **KPI.** Dejar de ser cuatro cajas iguales: el KPI principal (Total recaudado) grande, con cifra de 56-72 px y un anillo/arco de la flecha que se completa según el objetivo del periodo; los demás en una **franja** con separadores finos, sin cajas, con la variación como flecha direccional (la flecha de marca apuntando arriba/abajo) y no como píldora roja.
- **Vacíos.** Ilustración propia (la flecha circular que gira sola, una mata de café), titular con voz ("Aún nadie ha dado la vuelta por aquí") y acción clara ("Compartir enlace de donación"); nada de "No hay datos". Errores con la misma voz y sin culpa.
- **Sidebar.** Elemento activo con la flecha como indicador que se desliza entre ítems (`translateY`, 250 ms `power3.out`); el bloque "Sesión protegida con MFA" con el aro cerrado. Colapsar a rail con iconos propios (no Lucide).
- **Móvil.** Filtros en una hoja inferior con aro de estado visible (no 8 píldoras apiladas ocupando 1/3 de pantalla); rango de fechas con el calendario propio; tarjetas de donación con fecha-bloque a la izquierda y estado-aro a la derecha.
- **Movimiento mínimo y con propósito:** revelado de filas `yPercent 30 → 0` 250 ms `stagger 20 ms` solo en primera carga, contador de KPI al cargar, anillos que se completan; `prefers-reduced-motion` desactiva todo salvo el cambio de estado.

### Orden de ataque sugerido
1. Dirección de arte base: tipografía (familias y escala), planos de color y el concepto "dar la vuelta" con la flecha.
2. Piezas transversales: loader, cursor, transición de página, menú (E1, E10, E3).
3. Hero y "qué hacemos" (E4, E5), probando a 1440 y 390 con capturas y medición de solapes.
4. Territorio, donar, equipo (E6-E8).
5. Footer y panel (E9, E11).
6. Medir: Lighthouse con presupuesto alternativo, `prefers-reduced-motion`, FPS con CPU ×4 y sin solapes de texto a 5 anchos (método de `Genix\docs\03 - Decisiones\Fallos medidos.md`). Registrar el exceso de JS en una ADR.

---

## Enlaces

[[Animación y Movimiento]] · [[Interfaz Obligatoria del Sitio Público]] · [[Especificación del sitio]] · [[Guía de Frontend]]
