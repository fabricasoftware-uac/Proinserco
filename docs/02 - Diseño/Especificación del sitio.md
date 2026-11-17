---

tipo: especificación
estado: aprobada
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
---

# Especificación del sitio

Documento rector del proyecto. Aprobado por Michael el 2026-11-16. Todo lo que se construya obedece este documento, y por encima de él solo están el vault general (`D:\FabSoft\Documentación Proyectos`) y las ADR de `docs\03 - Decisiones`.

---

## Intención

Sitio nuevo de la **Fundación Proinserco** (Popayán, Cauca), que sustituye al Wix actual. Debe verse a nivel Awwwards: elegante, serio y divertido a la vez, con animación protagonista. Cuenta lo que hace la fundación y convierte visitas en **donaciones**, que es la acción principal de todo el recorrido.

## Reparto

| Parte                                                                                                                                          | Responsable                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Frontend completo (sitio público, flujo de donación, login, panel admin), contratos, mocks y documentación                                     | FabSoft frontend (Michael, con agentes) |
| Adaptadores reales: Supabase/Drizzle, Supabase Auth con MFA, Openpay y webhooks, despliegue en VPS DigitalOcean (Coolify) detrás de Cloudflare | Salomón, en el mismo repositorio        |
| Datos del cliente pendientes (NIT, RTE, fotos, logo original, cuenta Openpay)                                                                  | Michael y Salomón                       |

Git: el agente no inicializa el repositorio ni hace commits. Michael crea el repositorio y hace el primer commit.

## Objetivos

- Página pública que carga rápido y se siente premium en móvil y escritorio.
- Flujo de donación completo de punta a punta contra un adaptador en memoria.
- Panel de administración con registro de donaciones y donantes.
- Salomón puede conectar el backend sin tocar la interfaz y sin adivinar nada.

## Fuera de alcance (lo hace Salomón o es fase posterior)

- Llamadas reales a Openpay, base de datos real, autenticación real, envío de correos.
- Donación recurrente, blog, tienda, multidioma.
- Textos legales definitivos (se entregan borradores marcados para validación de un abogado).

## Lo que sería un fracaso aunque funcione

- Que parezca plantilla o banco de imágenes genérico.
- Que las animaciones tiren el rendimiento en móvil o mareen.
- Que un dato de tarjeta toque nuestro código.
- Que el panel admin sea accesible sin autenticar en servidor.
- Inventar datos de la fundación (cifras, NIT, proyectos) que no están en `docs\01 - Cliente\Contenido fuente.md`.

---

## Enfoques considerados

| Decisión  | Elegido                                                                                                                 | Descartado y por qué                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cobro     | **Checkout hospedado de Openpay (redirect)**: alcance PCI mínimo (SAQ A)                                                | Tokenización en página con Openpay.js: sube a SAQ A-EP y el script documentado para Colombia apunta a hosts `.mx` (sin verificar) |
| Backend   | **Mismo repositorio**, puertos con adaptadores en memoria                                                               | Servicio aparte: rompe el estándar y duplica contratos                                                                            |
| Hosting   | **VPS DigitalOcean + Coolify detrás de Cloudflare** (lo opera Salomón)                                                  | Vercel: el equipo ya tiene VPS y dominio en Cloudflare                                                                            |
| Animación | **GSAP (ScrollTrigger, SplitText, Flip, DrawSVG) + Lenis**, View Transitions y CSS scroll-driven como mejora progresiva | WebGL/3D: peso en móvil sin aportar al mensaje                                                                                    |

---

## Stack

El del vault general (`01 - Estándares\Stack Tecnológico Estándar.md`), en sus últimas versiones estables. Mínimos de seguridad: **Next.js ≥ 16.4.6**, React ≥ 19.3.1, sharp ≥ 0.35.5. Versiones exactas (`save-exact`). Monorepo `apps/web` + `packages/{ui,tokens,config}` según `02 - Arquitectura\Estructura de Carpetas.md`. `output: 'standalone'` y Dockerfile desde el día 1.

## Módulos

| Módulo        | Responsabilidad                                | Puertos (adaptador en memoria ahora, real después)                                 |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `donaciones`  | Crear intención de donación, estados, consulta | `RepositorioDonaciones`, `PasarelaPagos`                                           |
| `donantes`    | Datos del donante y su consentimiento          | `RepositorioDonantes`, `RegistroConsentimientos`                                   |
| `iam`         | Sesión, roles, MFA                             | `IdentityProvider`                                                                 |
| `auditoria`   | Registro de acciones del panel                 | `RegistroAuditoria`                                                                |
| `contenido`   | Contenido del sitio (estático tipado)          | ninguno                                                                            |
| transversales |                                                | `Reloj`, `VerificadorAntiBots` (Turnstile), `LimitadorDeTasa`, `PublicadorEventos` |

Estados de una donación: `creada → pendiente → aprobada | rechazada | expirada`; `aprobada → reembolsada | contracargo`. Las transiciones solo ocurren en servidor. Importe en `bigint` de centavos + `COP`; el monto se valida en servidor (mínimo y máximo configurables).

## Rutas

| Ruta                                                                                                                                     | Grupo      | Notas                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `/`                                                                                                                                      | `(public)` | Página principal, una sola página larga                                                    |
| `/donar`                                                                                                                                 | `(public)` | Formulario de donación en pasos                                                            |
| `/donar/resultado`                                                                                                                       | `(public)` | Lee el estado desde el servidor; el retorno de la pasarela nunca confirma nada por sí solo |
| `/legal/tratamiento-de-datos`, `/legal/aviso-de-privacidad`, `/legal/cookies`, `/legal/terminos`, `/legal/donaciones`                    | `(public)` | Borradores con aviso de validación legal                                                   |
| `/acceso`                                                                                                                                | `(auth)`   | Login + segundo factor (TOTP)                                                              |
| `/panel`, `/panel/donaciones`, `/panel/donaciones/[id]`, `/panel/donantes`, `/panel/donantes/[id]`, `/panel/auditoria`, `/panel/ajustes` | `(app)`    | `force-dynamic`, `no-store`, autenticación y permiso en cada página y acción               |
| `/api/webhooks/openpay`                                                                                                                  | api        | Esqueleto documentado; lo implementa Salomón                                               |
| `/api/health`                                                                                                                            | api        |                                                                                            |

---

## Dirección visual del sitio público

**Concepto: «dar la vuelta».** La flecha circular del logo es el hilo: una donación vuelve en forma de oportunidad. Aparece como motivo gráfico en el sitio y, como aro, en el panel.

**Tono**: serio y empresarial, con vida. Español de Colombia, tuteo. Se parte de los proyectos propios de FabSoft (Genix, Inventia y Cafetal; ver [[Lenguaje de diseño FabSoft]]), no de plantillas.

**Paleta y tipografía**: derivadas del logo (bosque, hoja, lima, crema, terracota, sol, cielo, tinta) como tokens «pintura»; titulares en Bricolage Grotesque, texto en Instrument Sans, display en Anybody y énfasis en Instrument Serif cursiva. Detalle en la [[Guía de Frontend]].

**Navegación**: navbar tradicional que cambia de color según la sección que tiene debajo, con indicador de sección; menú a pantalla completa; footer fusionado con la navbar.

**Criterios**

1. Nada de etiquetas pequeñas sobre los títulos.
2. Ningún efecto repetido en la página: cada sección entra y se comporta distinto.
3. Los logos se ven siempre transparentes, sin cajas de fondo.
4. Todo con diseño propio: sin iconos de librería ni patrones genéricos de plantilla, también en el panel (incluidas las fechas, con selector y presentación propios).
5. Movimiento reducido respetado en cada animación.

## Secciones de la página principal

1. **Hero** — foto a sangre dentro del marco, titular enorme con entrada por líneas, tarjeta flotante de donación (monto rápido + "Donar"), muesca de scroll.
2. **Quiénes somos** — texto grande con palabras resaltadas que se revelan con el scroll; collage de fotos con parallax suave. Cifra "22 años".
3. **Qué hacemos** — sección oscura **fijada**: el titular queda al centro y las tarjetas de colores entran desde la derecha escalonadas y con leve rotación, pasando por delante del titular (la animación del video). Seis tarjetas con lo que hace la fundación.
4. **Cómo trabajamos** — elaboración y ejecución de proyectos, en dos columnas que se apilan.
5. **Capacitaciones por sector** — educación, salud y agrícola, en rejilla bento con fotos; destaca "103 personas certificadas (meta: 80)".
6. **Territorio** — mapa del Cauca en SVG propio con municipios que se encienden; El Tambo y La Plata (Huila) mencionados en el contenido.
7. **Aliados** — cinta continua de logos (pausa al pasar el cursor y con movimiento reducido).
8. **Valores y principios** — palabras grandes en cinta o apilado interactivo.
9. **Equipo** — cinco tarjetas con foto, nombre y rol.
10. **Llamado a donar** — bloque a todo color con montos sugeridos.
11. **Contacto** — teléfono +57 300 651 8013, Calle 55 CN # 9B-66, barrio Santa Lucía, Popayán.
12. **Footer** — ver interfaz obligatoria.

Las secciones se apilan unas sobre otras al hacer scroll (la siguiente cubre a la anterior), como en el video.

## Interfaz obligatoria

Cumple íntegro `01 - Estándares\Interfaz Obligatoria del Sitio Público.md` del vault general:

- **Loader** con el logo: la barra de la "P" crece, el aro-flecha se dibuja girando, aparece "Al servicio de la comunidad", y una cortina crema revela el sitio. Solo primera visita de la sesión, con temporizador de seguridad, instantáneo con movimiento reducido.
- **Navbar** en pastilla flotante que cambia de tema según la sección (`data-nav-theme`), con micro-interacciones; el botón "Donar" siempre visible.
- **Fusión navbar–footer**: al llegar al final, el navbar baja y se acopla al footer formando una sola pieza.
- **Menú a pantalla completa** con enlaces enormes escalonados, CTA de donar y contacto.
- **Ir arriba**.
- **Barra fija "Donar" en móvil**, en la zona del pulgar, que no choca con el banner de cookies ni con el botón de ir arriba.
- **Banner de cookies** con Aceptar, Rechazar y Configurar.
- **Créditos en el footer**: `Created by Fábrica de Software` → https://www.fabsoft.app/ y `Powered by EmprendeLab` → https://www.emprendelab-web.com/, ambos en pestaña nueva con `rel="noopener noreferrer"`.

## Flujo de donación

1. Monto (sugeridos + libre, validado en servidor) y, opcional, a qué línea apoya.
2. Datos del donante: nombres, apellidos, tipo y número de documento, correo, celular; casilla **no premarcada** de autorización de tratamiento de datos con enlace a la política; casilla opcional "quiero certificado de donación".
3. Verificación anti-bots (Turnstile, validado en servidor) y resumen.
4. Server Action crea la donación `pendiente`, pide a `PasarelaPagos` un cargo con redirect y redirige a la URL de pago. El adaptador en memoria redirige a una **pasarela simulada** interna, claramente rotulada como entorno de pruebas, que permite elegir aprobar o rechazar.
5. `/donar/resultado` consulta el estado en servidor y muestra aprobada, pendiente o rechazada.

Nunca hay campos de tarjeta en nuestro sitio.

## Panel de administración

Estilo Apple: sobrio, mucho aire, tipografía de sistema, materiales translúcidos con moderación, muelles, **modo claro y oscuro** (sistema + selector). Barra lateral, resumen con indicadores y gráfica de donaciones, tablas con búsqueda, filtros, paginación y exportación CSV, detalle de donación y de donante, registro de auditoría, ajustes. Datos personales enmascarados por defecto. Login con correo, contraseña y segundo factor obligatorio. Cumple `01 - Estándares\Panel de Administración.md`.

## Seguridad (base que se deja montada)

Obedece `03 - Seguridad` del vault general. En este proyecto: cabeceras y CSP estricta, validación Zod en todo borde, acciones con `next-safe-action`, autenticación y permiso en cada página y acción del panel (el `proxy.ts` es solo UX), limitador de tasa y anti-bots tras puertos, entorno validado con Zod, sin source maps en producción, sin secretos en el bundle, dependencias con versión exacta y auditoría, `.gitignore` y escaneo de secretos listos.

## Imágenes

Fotos de ejemplo de Pexels descargadas por script de servidor a alta resolución y guardadas en el repositorio, con manifiesto (`archivo`, `sección`, `autor`, `url`) para que el cliente las sustituya. La clave vive solo en `.env.local`. Búsquedas orientadas al Cauca, los Andes colombianos, caficultores y talleres comunitarios.

---

## Enlaces

[[Contenido fuente]] · [[Análisis del video de referencia]]
