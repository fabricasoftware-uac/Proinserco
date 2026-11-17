---
tipo: handoff
estado: entregado
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
modulo: todos (donaciones, donantes, iam, auditoria, transversales)
frontend: Michael (FabSoft, con agentes)
backend: Salomón
---

# Handoff para Backend

Documento principal para Salomón. El frontend está **completo y funciona entero contra adaptadores en memoria**; el backend consiste en sustituir esos adaptadores por los reales **sin tocar la interfaz**. Este documento sigue la plantilla de [[Handoff Frontend a Backend]] del vault general y la adapta a lo que existe hoy en el código.

> [!danger] **Regla de oro**
> Si para conectar un adaptador real tienes que editar un archivo de `ui/` o de `apps/web/src/app/`, **el contrato estaba incompleto**: para, abre una PR de contrato (rama `feat/<modulo>-contrato`, revisada por Michael y por ti) y corrígelo ahí. Un cambio en `domain/` o en `application/ports/` nunca viaja escondido dentro de una PR de base de datos. La lista de cambios de contrato ya identificados está en la sección 9.

> [!warning] **Qué NO está en el repositorio (no lo des por hecho)**
> Dockerfile y `.dockerignore`, CI (GitHub Actions), CODEOWNERS, Dependabot, husky/lint-staged/commitlint, escaneo de secretos, batería E2E de Playwright (existe `apps/web/playwright.config.ts`, pero no el directorio `apps/web/e2e`), **tests de contrato compartidos** entre memoria y real, job de conciliación, migraciones, cliente de base de datos y esquema Drizzle, y envío de correos. Todo eso está en [[Pendientes]].

---

## 1. Dónde está cada cosa

| Qué | Ruta |
|---|---|
| Especificación rectora | `docs/02 - Diseño/Especificación del sitio.md` |
| Composition root (donde se eligen los adaptadores) | `apps/web/src/server/container.ts` |
| Variables de entorno validadas | `apps/web/src/server/env.ts` (servidor) y `apps/web/src/shared/env-publico.ts` (públicas) |
| Documentación de variables | `.env.example` en la **raíz** del repositorio |
| Server actions y límites | `apps/web/src/server/acciones.ts` (`accionPublica`, `accionPanel`, `conLimiteDeTasa`, `conAntiBots`, `conPermiso`) |
| Autenticación en páginas | `apps/web/src/server/auth-context.ts` (`obtenerActor`, `requireActor`) |
| IP del cliente | `apps/web/src/server/ip.ts` (`ipCliente`) |
| CSP y proxy | `apps/web/src/server/csp.ts`, `apps/web/src/proxy.ts` |
| Logs con redacción | `apps/web/src/server/registro.ts` |
| Webhook de Openpay | `apps/web/src/app/api/webhooks/openpay/route.ts` |
| Módulos de negocio | `apps/web/src/modules/{donaciones,donantes,iam,auditoria,contenido}` |
| Flujo que cruza módulos (donar) | `apps/web/src/flujos/donar/` |
| Transversales | `apps/web/src/shared/{domain,application/ports,infrastructure}` |
| Helper de tests con todo en memoria | `apps/web/src/test/mundo-memoria.ts` |

Todos los esqueletos reales llevan comentarios `// SALOMÓN:` con instrucciones. Para listarlos: buscar `SALOMÓN` dentro de `apps/web/src` (hay 8: `csp.ts`, `route.ts` del webhook, `limitador-redis.ts`, `identity-provider-supabase.ts`, `repositorio-donaciones-postgres.ts`, `registro-auditoria-postgres.ts` y dos en `repositorios-postgres.ts` de donantes). Léelos: este documento los amplía, no los reemplaza.

Notas de nombres: el código está en español (`crearDonacion`, `RepositorioDonaciones`, `PasarelaPagos`). Los módulos **no se importan entre sí**; solo se cruzan en `container.ts` y en `flujos/`. La regla de capas la comprueba `pnpm depcruise`.

---

## 2. Cómo arrancar el proyecto

Requisitos: Node 24 (`.nvmrc`, `engines`: `>=24.11.0 <25`) y pnpm 12.21.0 (campo `packageManager`; con corepack: `corepack pnpm …`).

```bash
pnpm install
cp .env.example apps/web/.env.local     # y rellenar SESION_SECRETO (>= 32 caracteres)
pnpm dev                                # http://localhost:3000
```

Generar `SESION_SECRETO`: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.

Con `ADAPTADORES=memoria` (valor por defecto) la app arranca completa. En `/acceso` aparecen los usuarios y códigos TOTP de demostración (solo con memoria y fuera de producción). Los datos de demostración (donantes, donaciones, auditoría) se siembran al primer uso del contenedor.

| Script | Qué hace |
|---|---|
| `pnpm verify` | typecheck + lint + depcruise + test + build. Es lo que debe pasar antes de fusionar |
| `pnpm test` | Vitest en todos los paquetes |
| `pnpm lint` | Biome + `scripts/verificar-primitivos.mjs` (impide tokens primitivos fuera de `packages/tokens`) |
| `pnpm depcruise` / `pnpm depcruise:grafo` | Reglas de capas (el grafo no debe salir vacío) |
| `pnpm audit:deps` | `pnpm audit --audit-level high` |
| `pnpm e2e` | Playwright (hoy sin pruebas: falta `apps/web/e2e`) |

Producción local: `pnpm build` y `node apps/web/.next/standalone/apps/web/server.js` (con memoria en producción hay que añadir `ADAPTADORES_MEMORIA_EN_PRODUCCION=si`).

---

## 3. El interruptor `ADAPTADORES=memoria|real`

Se decide **solo** en `apps/web/src/server/container.ts` (función `crearContenedor`): `const esMemoria = env.ADAPTADORES === 'memoria'`, y cada puerto se resuelve así:

| Puerto | `memoria` | `real` |
|---|---|---|
| Auditoría | `crearRegistroAuditoriaMemoria()` | `crearRegistroAuditoriaPostgres()` |
| Donantes y consentimientos | `crearRepositorioDonantesMemoria()` / `crearRegistroConsentimientosMemoria()` | `crearRepositorioDonantesPostgres()` / `crearRegistroConsentimientosPostgres()` |
| Donaciones | `crearRepositorioDonacionesMemoria()` | `crearRepositorioDonacionesPostgres()` |
| Pasarela | `crearPasarelaSimulada({ ids, urlBase })` | `crearPasarelaOpenpay({ merchantId, llavePrivada, urlApi })` |
| Identidad | `crearIdentityProviderMemoria(USUARIOS_DEMO, …)` | `crearIdentityProviderSupabase({ url, claveAnonima })` |

Dos puertos **no** dependen de `ADAPTADORES` sino de variables propias:

- Limitador de tasa: `LIMITADOR_URL` vacío → `crearLimitadorMemoria`; con valor → `crearLimitadorRedis(url)`.
- Anti-bots: `ANTIBOTS` (por defecto `turnstile` con `real`, `memoria` con `memoria`); con `turnstile` y `TURNSTILE_SECRET_KEY` → `crearVerificadorTurnstile`.

> [!danger] **Trampa**
> `crearLimitadorRedis` es un esqueleto: su `consumir()` lanza `NoImplementado`. Si pones `LIMITADOR_URL` **antes** de implementarlo, login, MFA, donar y el webhook empezarán a fallar con error. No definas la variable hasta que el adaptador exista.

### Protección contra memoria en producción

`env.ts` (`superRefine`) lanza un error al arrancar si `NODE_ENV=production` y `ADAPTADORES=memoria` salvo que se ponga `ADAPTADORES_MEMORIA_EN_PRODUCCION=si` (pensado para una demo pública; **jamás** en el sitio real). Además:

- `ADAPTADORES=real` exige `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `OPENPAY_MERCHANT_ID`, `OPENPAY_PRIVATE_KEY`, `OPENPAY_API_URL`, `OPENPAY_WEBHOOK_USUARIO`, `OPENPAY_WEBHOOK_CONTRASENA` y `TURNSTILE_SECRET_KEY`.
- `OPENPAY_API_URL` solo admite `https://sandbox-api.openpay.co` o `https://api.openpay.co`; producción **debe** usar la de producción y cualquier otro `NODE_ENV` el sandbox. Mezclarlas rompe el arranque.
- Mínimo de monto < máximo.
- Si `env.ts` falla, el log (JSON por línea) muestra solo nombres de variables y motivos, nunca valores.

Con `real` y sin `LIMITADOR_URL`, el contenedor registra una advertencia: el limitador en memoria solo vale con **una** instancia.

El contenedor no crea hoy ningún cliente de base de datos ni de Supabase compartido: **tú lo añades** en `container.ts` y lo pasas a los `crear…Postgres(...)`. Hoy esas funciones se llaman sin argumentos; cambiar sus firmas es parte de tu trabajo en `infrastructure/` y `container.ts`, no del contrato público (los puertos no cambian).

---

## 4. Puertos: del contrato al adaptador real

Leyenda: **ADR/Cont.** = archivo del contrato (puerto); **Memoria** = adaptador actual; **Real** = esqueleto a implementar (todas las rutas son relativas a `apps/web/src/`).

| Puerto | Contrato | Memoria | Esqueleto real a implementar | Controles de seguridad obligatorios |
|---|---|---|---|---|
| `RepositorioDonaciones` | `modules/donaciones/application/ports/repositorio-donaciones.ts` | `modules/donaciones/infrastructure/repositorio-donaciones-memoria.ts` | `modules/donaciones/infrastructure/repositorio-donaciones-postgres.ts` (`crearRepositorioDonacionesPostgres`) | RLS `ENABLE` + `FORCE`; `actualizarSiEstado` con `UPDATE … WHERE id = $1 AND estado = $2` y `rowCount === 1` (impide que dos webhooks apliquen dos veces); `referencia`, `clave_idempotencia` e `id_cargo` únicos; paginación por cursor, nunca `OFFSET`; filtros solo desde `FiltrosDonaciones` y parametrizados; importes `bigint` sin perder precisión; `SET LOCAL` (nunca `SET`) para el actor |
| `PasarelaPagos` | `modules/donaciones/application/ports/pasarela-pagos.ts` | `modules/donaciones/infrastructure/pasarela-simulada.ts` (`crearPasarelaSimulada`) | `modules/donaciones/infrastructure/pasarela-openpay.ts` (`crearPasarelaOpenpay`) | Basic auth con la llave privada (solo servidor); timeout (`AbortSignal.timeout(10_000)`); validar la respuesta con Zod; lista blanca de host para `urlPago`; nunca registrar cuerpo ni `Authorization`; nunca PAN/CVV; devolver importe y moneda tal como los reporta Openpay |
| `RepositorioDonantes` | `modules/donantes/application/ports/repositorio-donantes.ts` | `modules/donantes/infrastructure/repositorios-memoria.ts` (`crearRepositorioDonantesMemoria`) | `modules/donantes/infrastructure/repositorios-postgres.ts` (`crearRepositorioDonantesPostgres`) | RLS `ENABLE` + `FORCE`; `UNIQUE (tipo_documento, numero_documento)`; documento y celular son datos personales (valorar cifrado de columna con pgcrypto); nunca en logs; búsqueda `q` con índice trigram o prefijo, nunca `ILIKE '%x%'` sin índice; supresión = anonimizar, respetando plazos contables (validar con el contador) |
| `RegistroConsentimientos` | `modules/donantes/application/ports/registro-consentimientos.ts` | `modules/donantes/infrastructure/repositorios-memoria.ts` (`crearRegistroConsentimientosMemoria`) | `modules/donantes/infrastructure/repositorios-postgres.ts` (`crearRegistroConsentimientosPostgres`) | **Solo INSERT**: sin política de UPDATE ni DELETE para ningún rol de la app (ni administradores) y `REVOKE` explícito; la revocación es una fila nueva con `otorgada = false`; `ip` como `inet` |
| `IdentityProvider` | `modules/iam/application/ports/identity-provider.ts` (más `almacen-cookies.ts`) | `modules/iam/infrastructure/identity-provider-memoria.ts` | `modules/iam/infrastructure/identity-provider-supabase.ts` (`crearIdentityProviderSupabase`) | `getUser()` en servidor, jamás `getSession()`; AAL2 exigido; rol desde `app_metadata`, nunca `user_metadata`; mismo error genérico exista o no el correo; `signOut()` revoca el refresh token |
| `RegistroAuditoria` | `modules/auditoria/application/ports/registro-auditoria.ts` | `modules/auditoria/infrastructure/registro-auditoria-memoria.ts` | `modules/auditoria/infrastructure/registro-auditoria-postgres.ts` (`crearRegistroAuditoriaPostgres`) | **Solo INSERT** (RLS sin UPDATE/DELETE + `REVOKE`); `SELECT` solo con el permiso `auditoria:leer`; `detalles` nunca con datos personales completos ni secretos |
| `LimitadorDeTasa` | `shared/application/ports/limitador-de-tasa.ts` | `shared/infrastructure/limitador-memoria.ts` | `shared/infrastructure/limitador-redis.ts` (`crearLimitadorRedis`) | `INCR` + `EXPIRE` atómicos (`MULTI` o Lua), nunca `GET` + `SET`; timeout <= 200 ms; **fallar cerrado** si Redis cae en login, MFA y crear donación; no meter correos en claro en las claves (hashear) |
| `VerificadorAntiBots` | `shared/application/ports/verificador-anti-bots.ts` | `shared/infrastructure/verificador-anti-bots-memoria.ts` | **Ya implementado**: `shared/infrastructure/verificador-turnstile.ts` (`crearVerificadorTurnstile`). Solo falta configurar `TURNSTILE_SECRET_KEY` y la clave de sitio | Siteverify en servidor, token de un solo uso (300 s), falla cerrado, comprueba `hostname` contra `APP_URL` |
| `Auditor` | `shared/application/ports/auditor.ts` | Se conecta a `registrarAuditoria` (`modules/auditoria/application/use-cases/registrar-auditoria.ts`) en `container.ts` | No requiere adaptador propio | — |
| `RegistroDeDonantes` | `modules/donaciones/application/ports/registro-de-donantes.ts` | Puente en `container.ts` hacia `registrarDonante` | No requiere adaptador propio | — |
| `AlmacenCookies` | `modules/iam/application/ports/almacen-cookies.ts` | `server/cookies-next.ts` (`almacenCookiesNext`) | Ya funciona con `cookies()` de Next; encaja con `getAll`/`setAll` de `@supabase/ssr` | Cookies solo modificables en server actions y route handlers |
| `Reloj`, `GeneradorIds`, `PublicadorEventos` | `shared/application/ports/{reloj,generador-ids,publicador-eventos}.ts` | `shared/infrastructure/{reloj,generador-ids-cripto,publicador-eventos-memoria}.ts` | Sin esqueleto. `PublicadorEventos` en memoria es válido; una cola (para el webhook) sería una mejora, no un requisito | `GeneradorIds` ya usa `crypto` (UUID v4 y referencia `DON-` + 21 símbolos Crockford, >= 100 bits) |

Las operaciones y los errores de dominio de cada puerto están en el propio archivo del contrato y en `modules/*/domain/errores.ts` y `shared/domain/errores.ts` (los marcados `esPublico` son los únicos cuyo mensaje sale al navegador).

> [!note] **Tests de contrato**
> El estándar pide que **el mismo conjunto de tests** corra contra el adaptador en memoria y el real. Hoy no existen (los tests actuales, como `donaciones.test.ts` o `iam.test.ts`, usan solo memoria vía `src/test/mundo-memoria.ts`). Crearlos es parte de tu trabajo y de la definición de terminado: una PR de contrato con el archivo `*.contrato.ts` por puerto, ejecutado contra los dos.

### Orden de trabajo sugerido

1. Cliente de BD, migraciones y RLS (sección 5).
2. `RepositorioDonantes` y `RegistroConsentimientos` → `RepositorioDonaciones` → `RegistroAuditoria`. Con eso `/donar` crea registros reales aunque la pasarela siga simulada (no se puede: la pasarela simulada solo se instancia con memoria; usa el modo `real` con Openpay sandbox desde el paso 4).
3. `IdentityProvider` de Supabase con MFA (sección 8).
4. `PasarelaOpenpay` en sandbox + webhook (sección 7).
5. Limitador con Redis (cuando haya más de una instancia).
6. Conciliación diaria, correos, limpieza de demos y checklist de producción ([[Checklist de Seguridad para Producción]]).

---

## 5. Modelo de datos sugerido

> [!note] **Es una sugerencia derivada del código**
> El esquema de la base lo decide backend ([[Handoff Frontend a Backend]], sección 6). Lo de abajo sale de las entidades y esquemas Zod reales y de los comentarios `// SALOMÓN:`; ajústalo si tienes buena razón y registra el cambio.

Convenciones para todas las tablas: claves `uuid`; fechas `timestamptz` en UTC; **RLS `ENABLE` + `FORCE`** con denegación por defecto; políticas con `auth.uid()`/`auth.jwt()` envueltas en `(SELECT …)`; los importes **nunca** `numeric`/`float`: `bigint` de centavos + `moneda`.

### `donaciones` (entidad `Donacion`, `modules/donaciones/domain/donacion.ts`)

| Columna | Tipo / restricción | Origen |
|---|---|---|
| `id` | `uuid` PK | `DatosDonacion.id` |
| `referencia` | `text` UNIQUE NOT NULL, `CHECK (referencia ~ '^DON-[0-9A-HJKMNP-TV-Z]{21}$')` | `ReferenciaDonacion` en `domain/esquemas.ts`. Es el `order_id` en Openpay |
| `clave_idempotencia` | `uuid` UNIQUE NOT NULL | `DonacionEntrada.claveIdempotencia` (`z.uuid()`) |
| `estado` | `text` NOT NULL `CHECK (estado IN ('creada','pendiente','aprobada','rechazada','expirada','reembolsada','contracargo'))` | `EstadoDonacion` |
| `importe_centavos` | `bigint` NOT NULL `CHECK (importe_centavos > 0)` | `Importe.centavos` (10.000 COP = `1000000`) |
| `moneda` | `char(3)` NOT NULL `CHECK (moneda = 'COP')` | `Moneda` |
| `linea` | `text` NOT NULL `CHECK (linea IN ('donde-mas-se-necesite','educacion','salud','agricola'))` | `LineaApoyo` |
| `donante_id` | `uuid` NOT NULL FK → `donantes` | |
| `pagador_nombres`, `pagador_apellidos`, `pagador_correo` | `text` NOT NULL | Instantánea (`Pagador`) |
| `quiere_certificado` | `boolean` NOT NULL | |
| `id_cargo` | `text` UNIQUE NULL | Id del cargo en Openpay |
| `url_pago` | `text` NULL | Solo mientras `pendiente`; ver nota |
| `metodo_pago` | `text` NULL | `tarjeta`, `pse`… nunca datos de tarjeta |
| `creada_en`, `actualizada_en` | `timestamptz` NOT NULL | |

- `donaciones_transiciones` (**solo INSERT**): `donacion_id`, `desde`, `hacia` (mismo CHECK de estados), `en timestamptz`, `origen` (`CHECK IN ('servidor','conciliacion','webhook','panel')`). Alimenta `historial`. La transición y su fila se escriben **en la misma transacción** que el `UPDATE … WHERE estado = $esperado`.
- Índices: `(creada_en DESC, id DESC)` (cursor del panel), `(estado, creada_en)` (conciliación de pendientes y filtros), `(donante_id)`, `lower(pagador_correo)` con trigram (búsqueda `q` por referencia o correo) y los únicos de arriba.
- La máquina de estados **también** puede reforzarse en BD (trigger que rechace transiciones no válidas), pero la fuente de verdad es `TRANSICIONES` en `modules/donaciones/domain/estado-donacion.ts`. Si la cambias, cambia las dos.
- `url_pago` es una URL de Openpay con un token de pago; trátala como sensible: no la registres en logs.

### `donantes` (entidad `Donante`, `modules/donantes/domain/donante.ts`)

`id uuid` PK · `nombres`, `apellidos text` · `tipo_documento text CHECK (IN ('CC','CE','TI','PA','PPT','NIT'))` · `numero_documento text` (ya normalizado: sin puntos ni espacios, 4–20 caracteres alfanuméricos o guion) · `correo text` (en minúsculas, <= 254) · `celular text` (formato `+57` + 10 dígitos que empiezan por 3) · `quiere_certificado boolean` · `creado_en`, `actualizado_en`.
`UNIQUE (tipo_documento, numero_documento)`; índice por `correo` (y trigram para `q`). Documento y celular: valorar cifrado de columna (pgcrypto); si se cifra, la unicidad y la búsqueda exigen un hash determinista aparte. Decisión sobre pedir documento a todos: [[ADR-0007 - Tipo y número de documento a todo donante]] (propuesta).

El caso de uso `registrarDonante` es "upsert por documento": si ya existe actualiza los datos y hace `quiereCertificado = existente || nuevo`. El adaptador solo implementa `guardar` (inserta o actualiza por id) y las búsquedas.

> [!note] **Certificados**
> No existe en el código ninguna emisión de certificados ni tabla de certificados. El comentario del esqueleto menciona una tabla separada de acceso restringido para esos datos; es una decisión futura, no una dependencia de hoy.

### `consentimientos` (entidad `Consentimiento`, `modules/donantes/domain/consentimiento.ts`)

El comentario del esqueleto la llama `autorizaciones_datos`; **elige un nombre** (aquí `consentimientos`) y deja el comentario coherente.
`id uuid` · `donante_id uuid` FK · `correo text` · `finalidad text CHECK (IN ('gestion_donacion','certificado_donacion','boletin'))` · `version_texto text` (versión exacta del texto legal; hoy `borrador-2026-11-16`, en `CONTENIDO_SITIO.legal.versionPoliticaDatos`) · `otorgada boolean` · `ip inet NULL` · `user_agent text` (<= 300) · `creado_en`.
**Solo INSERT.** Cada finalidad es una autorización separada; nunca un "acepto todo".

### `auditoria` (`EntradaAuditoria`, `modules/auditoria/domain/entrada-auditoria.ts`)

`id uuid` · `ocurrido_en timestamptz` · `accion text CHECK (IN (…las 14 acciones de AccionAuditable…))` · `actor_id text` (<= 80: es el id de usuario **o** los literales `sistema` / `desconocido`, así que **no** es una FK a `auth.users`) · `recurso text` (<= 60) · `recurso_id text NULL` (<= 120) · `ip inet NULL` · `detalles jsonb`.
Acciones vigentes (`shared/domain/evento-auditable.ts`): `sesion.iniciada`, `sesion.fallida`, `sesion.mfa_fallido`, `sesion.cerrada`, `donacion.creada`, `donacion.transicion`, `donacion.discrepancia`, `donacion.consultada`, `donaciones.exportadas`, `donante.registrado`, `donante.dato_revelado`, `donantes.exportados`, `consentimiento.registrado`, `ajustes.cambiados`. Si añades una, es cambio de contrato.
**Solo INSERT**; `SELECT` con `auditoria:leer`; índice `(ocurrido_en DESC, id DESC)` y `(recurso, recurso_id)`.

> [!warning] **IP: cuidado con `inet`**
> `ipCliente()` devuelve la cadena `'desconocida'` cuando no hay IP válida, y los casos de uso la pasan tal cual a la auditoría y a los consentimientos. Una columna `inet` rechazaría ese valor: el adaptador debe convertir cualquier valor que no sea una IP a `NULL`.

### `idempotencia` (sugerida, no existe en el código)

Para deduplicar avisos del webhook: `clave text` PK (por ejemplo `openpay:<transaction.id>:<type>`) · `creado_en` · `resultado text NULL`. Hoy la deduplicación efectiva ocurre por la transición condicional (`actualizarSiEstado`); la tabla es opcional y sirve para métricas y para no repetir trabajo caro. La idempotencia de **crear** donación ya la da `donaciones.clave_idempotencia` UNIQUE.

### Perfiles y roles

- `usuario_roles` (nombre citado en el esqueleto de Supabase): `user_id uuid` FK → `auth.users`, `rol text CHECK (rol IN ('administrador','consulta'))`. **Solo el servidor escribe esta tabla.** Un Custom Access Token Hook la proyecta a `app_metadata.rol` del JWT.
- Los **permisos** viven en código (`PERMISOS_POR_ROL` en `modules/iam/domain/roles.ts`): `administrador` = todos; `consulta` = `panel:entrar`, `donaciones:leer`, `donantes:leer`, `auditoria:leer`, `ajustes:leer`. El código **nunca** pregunta por el rol, solo por permisos (`actor.puede(...)`). No hace falta tabla de permisos hoy.
- `perfiles` (opcional): `user_id`, `nombre` (`Identidad.nombre`), `creado_en`. `Identidad` pide `nombre`; sácalo de aquí o de `user_metadata` solo para mostrar (nunca para autorizar).
- Permisos que existen pero **no tienen funcionalidad todavía**: `donaciones:reembolsar`, `donantes:exportar`, `ajustes:editar`. No hay caso de uso ni pantalla para ellos.

### Roles de base de datos y RLS

| Quién | Cómo accede | Operaciones |
|---|---|---|
| Visitante que dona (server action `crearDonacionAccion`) | Rol de BD de **mínimo privilegio**, nunca el cliente admin dentro de una petición de usuario | `INSERT` en `donantes`, `consentimientos`, `donaciones`, `auditoria`; lecturas puntuales por `referencia` y `clave_idempotencia`; `UPDATE` de `donaciones` solo vía la función/transición permitida |
| Conciliación/webhook (sistema) | Rol de servicio acotado | `SELECT` y `UPDATE` condicional de `donaciones` (estado, `metodo_pago`), `INSERT` de transiciones y auditoría |
| Panel (actor aal2) | `conActor()` con `SET LOCAL` (usuario y claims) | `SELECT` según permisos; `INSERT` en `auditoria` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Se salta RLS.** Solo scripts y tareas administrativas, en un archivo aparte | Nunca en el flujo de una petición de usuario ni con `NEXT_PUBLIC_` |

Tests de seguridad obligatorios del vault ([[Estrategia de Testing]], [[Row Level Security (RLS)]]): aislamiento entre roles, concurrencia (dos webhooks simultáneos aplican **una** transición) y que `auditoria` y `consentimientos` rechazan `UPDATE` y `DELETE` incluso para el rol más alto de la app.

Conexión: `DATABASE_URL` por el pooler (puerto 6543) para la app, con `prepare: false` en el cliente; `DATABASE_URL_DIRECT` (5432) solo para migraciones.

---

## 6. Qué comportamiento actual de dominio debes respetar

- **Estados**: `creada → pendiente → aprobada | rechazada | expirada`; `aprobada → reembolsada | contracargo`. Los estados finales son `rechazada`, `expirada`, `reembolsada`, `contracargo`. Definidos en `TRANSICIONES` (`estado-donacion.ts`). Una transición inválida lanza `TransicionInvalida`.
- **Importe**: el navegador manda `montoPesos` (entero); el servidor lo valida contra `DONACION_MONTO_MINIMO_COP` y `DONACION_MONTO_MAXIMO_COP` (`importeDeDonacion`) y construye el `Importe` (`centavos = pesos * 100`). Nada calculado en el cliente se usa.
- **Crear donación** (`crearCrearDonacion`): interruptor `DONACIONES_HABILITADAS` → valida → busca `claveIdempotencia` (si hay una `pendiente` con `urlPago`, devuelve **la misma** URL; si no, `DonacionYaProcesada`) → registra donante y consentimientos → inserta donación `creada` → `pasarela.crearCargo` → `actualizarSiEstado(pendiente, 'creada')` → audita `donacion.creada` → publica evento. Si la pasarela falla (distinto de `NoImplementado`), lanza `PasarelaNoDisponible` y **la donación queda `creada`** (abandonada).
- **Conciliar** (`crearConciliarDonacion`): es **lo único que confirma o rechaza** una donación. Busca por `referencia` o por `idCargo`, consulta la pasarela, exige que `referencia` e importe/moneda **coincidan**; si no, audita `donacion.discrepancia` y no cambia nada. Mapea estados de cargo → donación y aplica solo caminos válidos (`creada` pasa por `pendiente`). Devuelve `no_encontrada`, `sin_cargo`, `sin_cambios`, `actualizada`, `discrepancia`, `transicion_invalida` o `carrera_perdida`.
- **Resultado público** (`/donar/resultado`, `crearConsultarResultadoDonacion`): valida la referencia, lee nuestra BD y, si sigue `pendiente`/`creada`, concilia; si la pasarela no responde, muestra "estamos confirmando" y **nunca inventa** un estado. Ignora cualquier parámetro que añada la pasarela a la URL de retorno.

Huecos que el código **no** resuelve y te tocan:

- **Conciliación periódica**: no existe el job. Hace falta (sección 7.7).
- **Donaciones `creada` abandonadas**: la comentada "la conciliación las limpia", pero `TRANSICIONES.creada` solo admite `pendiente`; una donación `creada` sin `idCargo` devuelve `sin_cargo` para siempre. Decide la política (por ejemplo, marcarlas `expirada` pasado un plazo) y, si eso exige permitir `creada → expirada`, es un cambio de contrato.
- **Reembolsos**: el puerto `PasarelaPagos` no tiene operación de reembolso ni hay pantalla; los reembolsos se hacen en el dashboard de Openpay y llegan por webhook/consulta (`refunded` → `reembolsada`).
- **Correos** (confirmación al donante, certificado): no existen.

---

## 7. Integración con Openpay Colombia, paso a paso

Referencia del vault: [[Pagos en Línea y Pasarelas]], sección "Openpay Colombia" (investigada el 2026-11-16). Decisión: [[ADR-0001 - Checkout hospedado de Openpay por redirect]]. Lo no verificado está marcado **Verificar**.

### 7.1 Entornos y credenciales

| | Sandbox | Producción |
|---|---|---|
| API | `https://sandbox-api.openpay.co` | `https://api.openpay.co` |
| Dashboard | `sandbox-dashboard.openpay.co` | `dashboard.openpay.co` |

- Basic auth: **llave privada como usuario, contraseña vacía**. El merchant id va en la ruta: `/v1/{MERCHANT_ID}/charges`.
- La llave pública solo crea tokens en el navegador; **no se usa** en este proyecto.
- Llaves distintas por entorno. La llave privada: solo servidor, nunca en logs, nunca con `NEXT_PUBLIC_`. Variables: `OPENPAY_MERCHANT_ID`, `OPENPAY_PRIVATE_KEY`, `OPENPAY_API_URL`.
- No uses el SDK `openpay` de npm (1.0.5, de 2020, sin mantenimiento): `fetch` propio.

### 7.2 Crear el cargo (`crearCargo`)

Se hace en `modules/donaciones/infrastructure/pasarela-openpay.ts`. El caso de uso ya entrega una `SolicitudCargo` con: `referencia` (nuestra `DON-…`), `importe`, `descripcion` (`'Donación a la Fundación Proinserco'`), `pagador` (nombres, apellidos, correo) y `urlRetorno` (`{APP_URL}/donar/resultado?referencia=DON-…`).

```jsonc
// POST {OPENPAY_API_URL}/v1/{MERCHANT_ID}/charges   (Basic auth: llave privada : "")
{
  "method": "card",
  "amount": 50000,              // Verificar formato exacto para COP (ver 7.9)
  "currency": "COP",
  "description": "Donación a la Fundación Proinserco",
  "order_id": "DON-XXXXXXXXXXXXXXXXXXXXX",   // = nuestra referencia, UNIQUE en BD
  "confirm": false,
  "send_email": false,
  "redirect_url": "https://<APP_URL>/donar/resultado?referencia=DON-...",
  "customer": { "name": "...", "last_name": "...", "email": "..." }
}
```

Reglas:

1. **Monto calculado en servidor**: el adaptador convierte `importe.centavos` al `amount` de Openpay. Esa conversión vive **solo** ahí y lleva test unitario. No leas el monto de ninguna otra fuente.
2. `order_id` = `solicitud.referencia`. Es nuestra idempotencia (columna UNIQUE). Openpay **no está confirmado** que rechace un segundo cargo con el mismo `order_id` (**Verificar**).
3. Respuesta esperada: `status` = `charge_pending` y `payment_method.url`. Valídala con Zod y devuelve `{ idCargo: id, urlPago: payment_method.url }`.
4. **Lista blanca del host de `urlPago`**: debe ser `https` y de un host de Openpay conocido; nuestro servidor redirige ahí (`redirect(urlPago)` en `flujos/donar/acciones.ts`). Cuando conozcas el host real del checkout, añádelo a `form-action` en `server/csp.ts` (comentario `// SALOMÓN:`): Chrome aplica `form-action` también a la redirección posterior al POST del formulario.
5. Errores: HTTP 402 con `error_code` 3005 = rechazo antifraude. Mapéalo a errores de dominio. Cualquier fallo de red o 5xx debe lanzar un error cualquiera: `crearDonacion` lo convierte en `PasarelaNoDisponible`. **Nunca** registres el cuerpo de la petición ni la cabecera `Authorization` (`registro.ts` ya redacta claves sensibles y patrones de 13–19 dígitos, pero no confíes solo en eso).
6. Timeout de 10 s con `AbortSignal.timeout(10_000)`.

### 7.3 El retorno del redirect NUNCA confirma

Openpay devuelve al donante a `redirect_url`. `/donar/resultado` **no** cambia estados por llegar ahí ni lee parámetros de la URL salvo `referencia`. Muestra el estado de **nuestra** BD y, si sigue pendiente, dispara una conciliación (consulta a la API). Hay tests que lo protegen: no los debilites.

### 7.4 Webhook `/api/webhooks/openpay`

El endpoint ya existe y ya responde de forma segura (`apps/web/src/app/api/webhooks/openpay/route.ts`). Orden actual: rate limit por IP (60/min) → Basic auth en tiempo constante (sin `OPENPAY_WEBHOOK_USUARIO`/`OPENPAY_WEBHOOK_CONTRASENA` responde **404**) → cuerpo con tope de 64 KB y validación Zod mínima → evento `verification` → consulta y conciliación.

Lo que debes saber de Openpay:

- **No firma sus webhooks** (sin HMAC; no hay lista de IPs publicada). Por tanto **un webhook es solo un aviso, nunca una orden**. Cualquiera que adivine la URL podría enviar `{"type":"charge.succeeded"}`.
- Al registrar la URL en el dashboard, Openpay envía un evento `verification` con `verification_code`. Se responde `200` y el código se introduce en el dashboard. El endpoint registra el código en el log (nivel `info`) para que lo copies.
- Tipos documentados (entre otros): `charge.created`, `charge.succeeded`, `charge.refunded`, `chargeback.created`, `chargeback.rejected`, `chargeback.accepted`. **Acepta tipos desconocidos con `200` y descártalos** (el código ya lo hace: si el cuerpo no cumple el esquema mínimo, responde 200).
- Exige **HTTPS con certificado válido y dominio** (no IP). Reintenta hasta recibir `200`.

Qué hacer ante **cualquier** evento con `transaction.id`:

1. `donaciones.conciliarDonacion({ idCargo: aviso.transaction.id }, 'webhook')`.
2. Eso consulta `GET {OPENPAY_API_URL}/v1/{MERCHANT_ID}/charges/{id}` con la llave privada (a través de `pasarela.consultarCargo`) y **solo entonces** transiciona, tras comparar `order_id`, importe y moneda.
3. **Deduplica** por id de transacción y estado: ya lo hace la transición condicional (`actualizarSiEstado`); un aviso repetido devuelve `sin_cambios`.
4. Responde `2xx` rápido. Hoy la conciliación se hace dentro de la petición; el esqueleto sugiere **encolar `{ idCargo }` y responder 200 en menos de 1 s**, con un consumidor que concilie. Si no montas cola, mantén la consulta corta (timeout) y que un fallo devuelva 5xx para que Openpay reintente.
5. Mientras `crearPasarelaOpenpay` lance `NoImplementado`, el endpoint responde **503** (así Openpay reintenta y no se pierden avisos). Al implementar el adaptador deja de ocurrir.

Mejoras de seguridad que el esqueleto pide y **aún no están hechas**:

- Mover la ruta a `/api/webhooks/openpay/[secreto]` con un secreto de >= 32 bytes aleatorios comparado en tiempo constante (404 si no coincide) y registrar esa URL **más** el Basic auth en el dashboard. Eso requiere una variable nueva (por ejemplo `OPENPAY_WEBHOOK_SECRETO_RUTA`, **no existe aún** en `env.ts` ni en `.env.example`; añádela a los dos).
- Comprobar en sandbox si Openpay envía las credenciales Basic también en el evento `verification`; si no las envía, el `401` impediría registrar el webhook (**Verificar**).
- Confirmar la forma real de `transaction` en los eventos de `chargeback.*` y `charge.refunded`: el esquema `Aviso` solo exige `transaction.id` (**Verificar**).

### 7.5 `consultarCargo` y traducción de estados

`GET {OPENPAY_API_URL}/v1/{MERCHANT_ID}/charges/{idCargo}`. Es **la fuente de verdad**. Devuelve un `CargoConsultado` con `idCargo`, `referencia` (el `order_id` que devuelve Openpay), `estado`, `importe` y `metodoPago`. El importe y la moneda se devuelven **tal como los reporta Openpay**: si no coinciden con los nuestros, `conciliarDonacion` no aprueba y audita la discrepancia.

Traducción propuesta (el esqueleto indica **Verificar la lista exacta de estados**):

| Estado de Openpay | `EstadoCargo` (puerto) | `EstadoDonacion` | Transición válida desde |
|---|---|---|---|
| `charge_pending`, `in_progress` | `pendiente` | `pendiente` | `creada` |
| `completed` | `aprobado` | `aprobada` | `pendiente` |
| `failed`, `cancelled` | `rechazado` | `rechazada` | `pendiente` |
| `expired` | `expirado` | `expirada` | `pendiente` |
| `refunded` | `reembolsado` | `reembolsada` | `aprobada` |
| `chargeback_*` | `contracargo` | `contracargo` | `aprobada` |

Cualquier estado desconocido: **no lo mapees a aprobado**; lanza error o tradúcelo a `pendiente` y registra una advertencia. Guarda solo método, últimos 4 dígitos y marca si vienen (hoy el modelo solo tiene `metodo_pago`).

### 7.6 Qué se guarda y qué jamás

| Se guarda | Jamás |
|---|---|
| Id del cargo de Openpay (`id_cargo`), nuestra `referencia` (`order_id`) | PAN (número completo de tarjeta) |
| Estado, importe, moneda, fechas | CVV / CVC |
| Método de pago (`tarjeta`, `pse`…) | Fecha de vencimiento junto con otros datos de tarjeta |
| Últimos 4 y marca, si Openpay los devuelve | Cuerpo completo de la respuesta de Openpay sin filtrar |
| `referencia`, `idCargo`, `estado`, `requestId` en logs | Cuerpo de la petición a Openpay, cabecera `Authorization`, la llave privada |

Nunca debe haber un campo de tarjeta en nuestro sitio. Test sugerido (vault): un logger de pruebas que falle si aparece un patrón de 13–19 dígitos o la palabra `cvv`.

### 7.7 Conciliación diaria (hay que construirla)

Los webhooks se pierden, las colas fallan, alguien aprueba a mano en el dashboard. Un job diario (tarea programada de Coolify o cron, protegido; no una ruta pública sin autenticación):

1. Donaciones `pendiente` con más de N horas (y `creada` con `id_cargo`) → `conciliarDonacion({ referencia }, 'conciliacion')`. El caso de uso ya existe; falta el disparador.
2. Listado de transacciones de Openpay del día anterior vs. nuestra tabla `donaciones` (id, estado, importe, moneda).
3. Cualquier diferencia ⇒ alerta a la persona responsable y registro. **No** se corrige automáticamente un `aprobada` que Openpay no confirma.
4. Test con adaptador de pasarela en memoria que siembre discrepancias; su fallo dispara alerta.

### 7.8 Sandbox y tarjetas de prueba

Solo sandbox, nunca una tarjeta real en ningún entorno de prueba:

| Número | Resultado |
|---|---|
| `4111111111111111` | Aprobada |
| `5555555555554444` | Aprobada |
| `4222222222222220` | Rechazada (3001) |
| `4000000000000069` | Vencida (3002) |
| `4444444444444448` | Fondos insuficientes (3003) |
| `4000000000000119` | Robada (3004) |
| `4000000000000044` | Fraude (3005) |

Qué datos de vencimiento/CVV acepta el sandbox no está documentado en el vault (**Verificar**). Para probar el webhook en local necesitas una URL pública con HTTPS y dominio (túnel); no uses una IP. Corre los E2E contra el sandbox en un job aparte, no en cada PR.

### 7.9 Preguntas abiertas para el soporte de Openpay

Guarda las respuestas por escrito en `docs/03 - Decisiones/` (nuevo archivo o ADR):

- [ ] ¿Cuál es el script y el host de Openpay.js correctos para Colombia? (el archivo conocido es de 2018 y solo tiene hosts `.mx`; solo importa si algún día se cambia de integración)
- [ ] ¿Se puede crear un cargo PSE por API? ¿Con qué campos y qué flujo de retorno? (el vault solo documenta PSE por link de cobro desde el dashboard)
- [ ] ¿Cómo funciona 3D Secure en Colombia? ¿Es obligatorio, configurable, aplica al checkout hospedado?
- [ ] ¿`order_id` garantiza idempotencia (rechaza un segundo cargo con el mismo `order_id`)?
- [ ] ¿Ofrecen suscripciones/cargos recurrentes para entidades sin ánimo de lucro (ESAL)?
- [ ] Tarifas, plazos de abono y retenciones aplicables.
- [ ] ¿Qué SAQ de PCI DSS aplica con checkout hospedado? (por escrito)
- [ ] ¿Planean firmar los webhooks o publicar sus IPs?
- [ ] Formato exacto de `amount` para COP: ¿entero en pesos o con decimales? (hoy `importe.centavos` = pesos x 100; la conversión debe ser explícita y con test)
- [ ] Plazos y proceso de disputa de contracargos.
- [ ] Además: lista exacta de estados de un cargo, forma de `transaction` en cada tipo de evento, host del checkout hospedado, y si el evento `verification` lleva Basic auth.

### 7.10 Antifraude y card testing (lo que ya hay)

Rate limit en `crearDonacionAccion` (5 por IP / 10 min y 3 por correo / 10 min) **antes** de Turnstile, Turnstile **antes** de validar y de tocar la pasarela, límites de monto, honeypot (`sitioWeb`) y el interruptor de emergencia `DONACIONES_HABILITADAS=no`. El runbook de incidentes de pagos está en el vault.

---

## 8. Autenticación real (Supabase Auth)

Referencia: esqueleto `modules/iam/infrastructure/identity-provider-supabase.ts` y [[Autenticación y Autorización]] del vault. El navegador **nunca** habla con Supabase: todo pasa por server actions (`modules/iam/ui/acciones.ts`: `iniciarSesionAccion`, `verificarSegundoFactorAccion`, `cerrarSesionAccion`).

Qué debe hacer cada método del puerto `IdentityProvider`:

| Método | Supabase |
|---|---|
| `iniciarSesion(credenciales, cookies)` | `auth.signInWithPassword`. Ante **cualquier** error lanza `CredencialesInvalidas` (mismo mensaje exista o no el correo). La sesión queda en aal1 |
| `desafioPendiente(cookies)` | Devuelve el id de usuario mientras el nivel sea aal1 con un factor TOTP verificado disponible; si no, `null` (sirve para limitar intentos por usuario) |
| `verificarSegundoFactor(codigo, cookies)` | `auth.mfa.challengeAndVerify({ factorId, code })` con el factor TOTP del usuario → sesión aal2. Si no tiene factor: pantalla de alta de TOTP que **no se puede saltar**; nunca dejar pasar en aal1. Código inválido o reutilizado → `CodigoMfaInvalido` ("El código no es válido o ya se usó"); desafío caducado → `DesafioMfaExpirado` |
| `obtenerIdentidad(cookies)` | `auth.getUser()` (valida el JWT contra Supabase), **jamás** `getSession()`. Nivel con `auth.mfa.getAuthenticatorAssuranceLevel()`. Rol desde `app_metadata` (Custom Access Token Hook sobre `usuario_roles`), **nunca** `user_metadata`. Devuelve `Identidad` con `expiraEn` |
| `cerrarSesion(cookies)` | `auth.signOut()` (revoca el refresh token) y borrar cookies |

`obtenerActor` (`modules/iam/application/use-cases/obtener-actor.ts`) solo construye un `Actor` si `nivel === 'aal2'`; una sesión que solo pasó la contraseña no es un actor del panel.

Configuración del proyecto Supabase: contraseña mínima de 12 caracteres (el esquema `Credenciales` ya la exige), HIBP activado, confirmación de correo, JWT de 3600 s, rotación y detección de reutilización de refresh tokens, rate limit de Auth, URLs de redirección **exactas** (sin comodines). Cliente de servidor con `@supabase/ssr` (`createServerClient(url, claveAnonima, { cookies })`, usando `cookies.todas()` y `cookies.establecer()` del `AlmacenCookies`). El cliente admin (service role) va en un archivo separado y nunca en el flujo de una petición.

### Cookies

Cookies `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, sin `Domain`. En HTTPS llevan el prefijo `__Host-` (`server/nombres-cookies.ts`: `__Host-proinserco_sesion` y `__Host-proinserco_mfa`; en HTTP, sin prefijo). Hoy el desafío MFA dura 5 minutos (`DESAFIO_MINUTOS` en el adaptador en memoria).

> [!danger] **Reconciliar los nombres de cookie con el proxy**
> `src/proxy.ts` redirige a `/acceso` si **no existe** una cookie llamada como `NOMBRES_COOKIE_SESION` (`proinserco_sesion` / `__Host-proinserco_sesion`). `@supabase/ssr` usa por defecto otros nombres (`sb-<ref>-auth-token`, partidas en trozos `.0`, `.1`…). O configuras `cookieOptions.name` y adaptas la comprobación a cookies partidas, o cambias `nombres-cookies.ts`. Si no, el proxy mandará **siempre** a `/acceso` aunque haya sesión válida. El proxy es solo comodidad: la seguridad real está en `requireActor`.
> El esqueleto además pide que el proxy refresque la sesión con `getUser()` y devuelva **la misma** respuesta que acumuló las cookies; si lo haces, no conviertas al proxy en control de acceso.

### Lo que hay que conservar del comportamiento actual

- **Mensajes genéricos**: `CredencialesInvalidas` es idéntico exista o no el correo; el login en memoria calcula un hash aunque el usuario no exista (tiempo constante). La auditoría registra los fallos como `sesion.fallida` con actor `desconocido`.
- **TOTP no reutilizable**: un código válido no se puede usar dos veces (anti-replay por contador). Supabase lo gestiona; verifica que el comportamiento coincida.
- **`requireActor()` en cada página del panel y en cada layout** (`server/auth-context.ts`): sin sesión aal2 redirige a `/acceso`; con sesión pero sin el permiso responde 404 (no confirma que el recurso exista). **`accionPanel`** exige actor en cada server action y **`conPermiso('recurso:accion')`** el permiso concreto. Ninguna acción nueva sin ellos.
- **El proxy es solo UX** (cabecera del archivo): jamás protejas nada solo ahí.
- Panel `force-dynamic` y `no-store`, `noindex`.
- Límites de login: 10 por IP y 5 por correo cada 15 min; MFA: 10 por IP y 5 por usuario del desafío cada 15 min (`iniciarSesionAccion`, `verificarSegundoFactorAccion`). Panel: 100 acciones/min por IP.
- Cada paso queda en auditoría con IP: `sesion.iniciada` (dos veces: `factor: 'contrasena'` y `factor: 'totp'`), `sesion.fallida`, `sesion.mfa_fallido`, `sesion.cerrada`.
- Sesión del adaptador en memoria como referencia de política: inactividad de 30 minutos y duración absoluta de 8 horas (`container.ts`). Replica algo equivalente: Supabase puede ofrecer sesiones con tope de tiempo y por inactividad según el plan (**Verificar** disponibilidad en el plan contratado); si no, impleméntalo en la aplicación. Las páginas legales de cookies tienen marcadores `[POR DEFINIR]` para la duración real de la sesión y del desafío: **decídelo tú** y dilo a Michael.

### Bloqueo progresivo

El código actual solo aplica **límite de tasa** (por IP y por identidad); **no** existe bloqueo progresivo por cuenta. Debe añadirse al backend real: tras N fallos consecutivos para un usuario, espera creciente (por ejemplo 1, 5, 15 minutos) y alerta; sin revelar si la cuenta existe. Dónde: dentro de `iniciarSesion` del adaptador o con contador en Redis/BD por `hash(correo)`. Es un comportamiento nuevo, no una modificación de contrato.

### Alta de usuarios del panel

No hay pantalla para crear usuarios ni invitar. Mientras tanto: crear usuarios en Supabase por invitación, insertar su fila en `usuario_roles` y enrolar su TOTP. Los datos de `usuarios-demo.ts` y `demo.ts` **no** deben existir en producción (sección 9, punto 8).

---

## 9. Anti-bots y límites

### Turnstile (ya implementado)

- Flujo: el widget (paso 3 del formulario) entrega un token → `conAntiBots` (`server/acciones.ts`) lo verifica **en servidor** con `crearVerificadorTurnstile` (`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`, timeout 5 s) **antes** de validar y de tocar la pasarela. **Falla cerrado** ante cualquier anomalía (red, timeout, `success: false`, `hostname` distinto de `APP_URL`, token vacío o > 2048).
- El token es de **un solo uso** y válido **300 s**: tras cualquier fallo el formulario pide uno nuevo (`reinicioAntiBots`). No cachees verificaciones.
- Variables: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (pública; **se incrusta en el build**; por defecto la de pruebas `1x00000000000000000000AA`) y `TURNSTILE_SECRET_KEY` (secreta). Como la imagen se construye en CI, la clave de sitio de producción debe pasarse como argumento de build. Crear el widget y las claves en el dashboard de Cloudflare.
- Con las claves de prueba de Cloudflare comprueba que el `hostname` que devuelve siteverify coincide con el de `APP_URL`; si no, el verificador rechazará siempre (**Verificar** en tu entorno).

### Limitador de tasa

- Puerto `LimitadorDeTasa.consumir(clave, limite, ventanaSegundos)` → `{ permitido, restantes, reintentarEnSegundos }`. Las claves llegan construidas: `<accion>:ip:<ip>` y `<accion>:id:<identidad>`; `webhook-openpay:ip:<ip>`, `verificar-mfa:usuario:<id>`.
- Límites vigentes: crear donación 5 / 10 min por IP y 3 / 10 min por correo; login 10 / 15 min por IP y 5 / 15 min por correo; MFA 10 / 15 min por IP y 5 / 15 min por usuario; exportar donaciones 5 / 5 min; revelar dato 30 / 5 min; webhook 60 / min; panel 100 / min; código demo 20 / 5 min.
- Con más de una instancia **hace falta almacén compartido**: Redis del VPS (Coolify) o Upstash, URL en `LIMITADOR_URL` (`rediss://`, TLS). Implementa `crearLimitadorRedis` con `INCR` + `EXPIRE` atómicos, timeout corto y **fallo cerrado** en login, MFA y crear donación. Ver la trampa de la sección 3.

### IP real detrás de Cloudflare

`ipCliente(headers)` en `server/ip.ts`:

- `DESPLIEGUE=cloudflare` → cabecera `CF-Connecting-IP`. **Solo es fiable si el origen rechaza todo lo que no venga de Cloudflare** (firewall del VPS con los rangos publicados por Cloudflare, o Cloudflare Tunnel). Si no, cualquiera la falsifica y salta los límites.
- `DESPLIEGUE=directo` → `X-Real-IP` que fija el proxy de Coolify (Traefik).
- Nunca se usa `X-Forwarded-For` crudo. Sin IP válida devuelve `'desconocida'`: un cubo compartido y estricto, nunca "sin límite".
- Verificación: `curl -k https://<IP-del-origen>` desde fuera debe fallar o agotar el tiempo. Test sugerido: enviar `X-Forwarded-For` falso y comprobar que el limitador sigue contando contra la IP real.

---

## 10. Mejoras que el frontend ya necesita del backend

Recogidas durante la construcción. **Cada una toca el contrato** (esquemas, puertos o `Actor`), así que va en PR de contrato, con el cambio de interfaz acordado con Michael.

| # | Mejora | Estado hoy y dónde | Qué hay que hacer |
|---|---|---|---|
| 1 | Fecha y `quiereCertificado` en el resultado público | `ResultadoPublicoDonacion` (`modules/donaciones/application/use-cases/consultar-resultado-donacion.ts`) solo trae `estado`, `montoPesos`, `referencia` | Añadir `fecha` (de la donación) y `quiereCertificado`, y mostrarlos en `app/(public)/donar/resultado/page.tsx` |
| 2 | Filtros y orden dentro de los puertos | `FiltrosDonaciones` solo tiene `estado`, `linea`, `q`, `desde`, `hasta`. Filtro por **monto** y **orden por columna** (fecha/monto/estado) se resuelven en el panel escaneando como máximo **1.000 filas** (`TOPE_ESCANEO` en `modules/donaciones/ui/consulta-panel.ts`). En auditoría, el filtro por **fecha** también escanea 1.000 eventos (`app/(app)/panel/auditoria/page.tsx`) | Añadir a `FiltrosDonaciones` `minCentavos`/`maxCentavos` y `orden`/`dir`; añadir `desde`/`hasta` a `FiltrosAuditoria`; resolver en SQL con cursor. Después la interfaz deja de escanear y de mostrar el aviso de truncado |
| 3 | `expiraEn` y lista de sesiones en `Actor` | `Identidad.expiraEn` existe, pero `Actor` (`shared/domain/actor.ts`) no lo lleva ni hay puerto para listar sesiones; `panel/ajustes` muestra "No disponible" | Añadir `expiraEn` al `Actor` (para el aviso de sesión por expirar) y una operación de listado de sesiones al `IdentityProvider` |
| 4 | Propagar `reintentarEnSegundos` al cliente | `DemasiadasPeticiones.reintentarEnSegundos` existe, pero `aErrorAccion` (`server/acciones.ts`) devuelve `{ codigo, mensaje, requestId }` sin él; el formulario de acceso usa un mensaje fijo | Ampliar `ErrorAccion` con `reintentarEnSegundos?` y mostrar la espera real |
| 5 | IP real en auditoría | Los casos de uso reciben `ip` de `contextoPeticion()`, que depende de `DESPLIEGUE`; las transiciones y discrepancias de conciliación auditan con `ip: null` (no hay petición de usuario) | Garantizar `DESPLIEGUE=cloudflare` con origen cerrado; convertir `'desconocida'` a `NULL` en BD; para el webhook, auditar la IP de origen del aviso |
| 6 | Errores de validación del donante por campo | `defaultValidationErrorsShape: 'flattened'` en `server/acciones.ts`: los errores anidados (`donante.correo`…) llegan aplanados y el formulario solo muestra un aviso genérico ("Revisa los pasos 1 y 2", `flujos/donar/formulario-donar.tsx`) | Cambiar la forma de errores (por ejemplo `'formatted'`) y mapear a los campos del paso 2 |
| 7 | Reembolso, exportar donantes, editar ajustes | Permisos declarados sin funcionalidad (`donaciones:reembolsar`, `donantes:exportar`, `ajustes:editar`) | Decidir con Michael y la fundación si entran; si sí, contrato nuevo |
| 8 | **Eliminar datos y secretos de demostración antes de producción** | Ver lista abajo | Borrar y comprobar que `pnpm verify` sigue en verde |

### Qué hay que eliminar antes de producción (punto 8)

- `apps/web/src/app/(auth)/acceso/demo.ts` (usuarios, contraseñas y secretos TOTP de demostración repetidos para mostrarlos) y `apps/web/src/app/(auth)/acceso/acciones-demo.ts` (`codigoDemoAccion`, que devuelve el código TOTP vigente). Ambos solo responden con `ADAPTADORES=memoria` y fuera de producción, pero los secretos están **en el repositorio**. `formulario-acceso.tsx` y `page.tsx` de esa carpeta los usan: hay que quitar esas referencias en una PR de interfaz acordada con Michael.
- `apps/web/src/modules/iam/infrastructure/usuarios-demo.ts` (contraseñas y secretos TOTP) y el adaptador `identity-provider-memoria.ts` si se decide no conservar el modo demo.
- La pasarela simulada y sus piezas: `modules/donaciones/infrastructure/pasarela-simulada.ts`, `modules/donaciones/ui/acciones-pasarela-simulada.ts`, `app/(public)/donar/pasarela-simulada/page.tsx` (la ruta está excluida en `app/robots.ts`).
- Semillas ficticias: `semilla-donaciones.ts`, `semilla-donantes.ts`, `semilla-auditoria.ts` y el helper `aleatorio-determinista.ts`.
- Ninguna de esas rutas debe poder alcanzarse con `ADAPTADORES=real`; verifícalo con una petición real en el entorno de staging.
- Si alguna vez se desplegó una demo pública con `ADAPTADORES_MEMORIA_EN_PRODUCCION=si`: considerar esos secretos TOTP y contraseñas **comprometidos** y nunca reutilizarlos.

---

## 11. Variables de entorno

Fuente: `.env.example` (raíz) y `apps/web/src/server/env.ts`. Local: copiar a `apps/web/.env.local` (ignorado por Git). Producción: variables del recurso en Coolify. **Un secreto distinto por entorno.** "Obligatoria" se refiere a lo que `env.ts` exige hoy.

| Variable | Para qué | Tipo | Dónde se obtiene | Obligatoria |
|---|---|---|---|---|
| `NODE_ENV` | Entorno (`development`, `test`, `production`) | Pública (no secreta) | La fija Next/Docker | Siempre (por defecto `development`) |
| `APP_URL` | URL pública del sitio, sin barra final. Con `https` activa cookies `__Host-`, `Secure` y `upgrade-insecure-requests`; construye la URL de retorno de pagos; es el hostname que Turnstile debe devolver | Pública (no secreta) | Dominio definitivo | **Siempre** (sin valor por defecto) |
| `ADAPTADORES` | `memoria` o `real` | No secreta | Decisión del entorno | Opcional (por defecto `memoria`) |
| `ADAPTADORES_MEMORIA_EN_PRODUCCION` | Autoriza memoria en producción (solo demo pública) | No secreta | Michael | Opcional (`no`) |
| `ANTIBOTS` | `memoria` o `turnstile`. Por defecto turnstile con `real` | No secreta | — | Opcional |
| `DESPLIEGUE` | `cloudflare` (usa `CF-Connecting-IP`; solo con origen cerrado) o `directo` (`X-Real-IP`) | No secreta | Decisión de infraestructura | Opcional (`directo`) |
| `SESION_SECRETO` | Firma las cookies de sesión del adaptador en memoria. >= 32 caracteres aleatorios | **Secreta** | Generada (`randomBytes`) | **Siempre** (`env.ts` la exige también en `real`, aunque Supabase no la use; valida si conviene relajarlo en PR de contrato) |
| `DONACIONES_HABILITADAS` | Interruptor de emergencia: `no` desactiva crear cargos sin desplegar | No secreta | — | Opcional (`si`) |
| `DONACION_MONTO_MINIMO_COP` | Mínimo de donación en pesos (card testing) | No secreta | Fundación | Opcional (`10000`) |
| `DONACION_MONTO_MAXIMO_COP` | Máximo en pesos; debe ser mayor que el mínimo | No secreta | Fundación | Opcional (`20000000`) |
| `CSP_SOLO_REPORTE` | `si` = `Content-Security-Policy-Report-Only` (despliegue progresivo) | No secreta | — | Opcional (`no`) |
| `SUPABASE_URL` | URL del proyecto Supabase (solo servidor) | No secreta (sin `NEXT_PUBLIC_`) | Supabase, Settings, API | Con `ADAPTADORES=real` |
| `SUPABASE_ANON_KEY` | Clave anónima (solo servidor; el navegador nunca habla con Supabase) | Semi-pública, sin `NEXT_PUBLIC_` | Supabase, Settings, API | Con `ADAPTADORES=real` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio: **se salta RLS** por completo. Solo tareas administrativas | **Secreta crítica** | Supabase, Settings, API | No la exige `env.ts`; solo si hay tareas administrativas |
| `DATABASE_URL` | Cadena de conexión por el pooler (puerto 6543), para la app | **Secreta** | Supabase | Con `ADAPTADORES=real` |
| `DATABASE_URL_DIRECT` | Conexión directa (5432), **solo** para migraciones | **Secreta** | Supabase | No la exige `env.ts`; para migraciones |
| `OPENPAY_MERCHANT_ID` | Id del comercio (va en la ruta de la API) | No secreta | Dashboard de Openpay | Con `ADAPTADORES=real` |
| `OPENPAY_PRIVATE_KEY` | Llave privada (Basic auth) | **Secreta crítica** | Dashboard de Openpay | Con `ADAPTADORES=real` |
| `OPENPAY_API_URL` | `https://sandbox-api.openpay.co` o `https://api.openpay.co`; `env.ts` impide mezclarlas | No secreta | Ver sección 7.1 | Con `ADAPTADORES=real` |
| `OPENPAY_WEBHOOK_USUARIO` | Usuario del Basic auth del webhook (>= 8 caracteres) | **Secreta** | Se inventa y se registra en el dashboard | Con `ADAPTADORES=real` (sin ella, el webhook responde 404) |
| `OPENPAY_WEBHOOK_CONTRASENA` | Contraseña del Basic auth del webhook (>= 24 caracteres) | **Secreta** | Se genera y se registra en el dashboard | Con `ADAPTADORES=real` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave de sitio de Turnstile. **Se incrusta en el build** | **Pública** | Dashboard de Cloudflare (por defecto `1x00000000000000000000AA`, de pruebas) | Opcional (tiene valor por defecto de pruebas: en producción **debe** ser la real) |
| `TURNSTILE_SECRET_KEY` | Clave secreta de Turnstile (siteverify) | **Secreta** | Dashboard de Cloudflare | Con `ADAPTADORES=real` o `ANTIBOTS=turnstile` |
| `LIMITADOR_URL` | Redis (`rediss://…`) para el limitador compartido. Vacío = memoria | **Secreta** | Redis del VPS / Upstash | Opcional; **no la pongas antes de implementar `limitador-redis.ts`** |
| `PEXELS_API_KEY` | Solo para `scripts/pexels.mjs` (fotos de ejemplo) | Secreta | Cuenta de Pexels | No la usa la app. En `apps/web/.env.local`, nunca en el repositorio ni en producción. **Hay que rotarla** (ver checklist) |
| `PUERTO_E2E` | Puerto de Playwright (por defecto 3100) | No secreta | — | Solo para E2E; no está en `.env.example` |

Nuevas variables que probablemente necesites y **no existen**: secreto de ruta del webhook (7.4), variable de la API de Redis si usas Upstash REST, y las de correo si se envían correos. Todas se añaden a `env.ts` **y** a `.env.example` con su comentario (dueño, pública o secreta, de dónde sale), y a los tests de `env`.

---

## 12. Definición de terminado (backend)

Del estándar de [[Handoff Frontend a Backend]], adaptada:

- [ ] Los adaptadores reales pasan **los mismos** tests de contrato que los de memoria (hay que escribirlos, sección 4).
- [ ] Migraciones con RLS `ENABLE` + `FORCE` y los tres tests de seguridad obligatorios.
- [ ] Sin cambios en `ui/` ni en `app/` salvo PR de contrato aprobada por los dos.
- [ ] E2E de los flujos críticos (donar de punta a punta, login con MFA) en verde con `ADAPTADORES=real` contra staging.
- [ ] Openpay y Turnstile probados en sandbox; webhook probado con eventos reales de sandbox y con un aviso falso que **no** aprueba nada.
- [ ] `.env.example` con las variables nuevas documentadas.
- [ ] Datos de demostración eliminados (sección 10, punto 8).
- [ ] [[Checklist de Seguridad para Producción]] completa.
- [ ] Las preguntas abiertas de Openpay (7.9) respondidas por escrito, y las decisiones registradas.

---

## Enlaces

Documentos del proyecto: [[ProInserco]] · [[Especificación del sitio]] · [[Checklist de Seguridad para Producción]] · [[Pendientes]] · [[Guía de Frontend]] · [[ADR-0001 - Checkout hospedado de Openpay por redirect]] · [[ADR-0002 - Backend en el mismo repositorio tras puertos]] · [[ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare]] · [[ADR-0004 - CSP con nonce y páginas dinámicas]] · [[ADR-0007 - Tipo y número de documento a todo donante]]

Vault general (solo lectura, `D:\FabSoft\Documentación Proyectos`):

| Nota | Ruta |
|---|---|
| [[Handoff Frontend a Backend]] | `02 - Arquitectura\Handoff Frontend a Backend.md` |
| [[Pagos en Línea y Pasarelas]] (sección Openpay Colombia) | `03 - Seguridad\Pagos en Línea y Pasarelas.md` |
| [[Privacidad y Habeas Data]] | `03 - Seguridad\Privacidad y Habeas Data.md` |
| [[Protección contra DDoS, Bots y Abuso]] | `03 - Seguridad\Protección contra DDoS, Bots y Abuso.md` |
| [[Despliegue en VPS con Coolify]] | `04 - Infraestructura\Despliegue en VPS con Coolify.md` |
| [[Plantilla - Nuevo Proyecto]] · [[Plantilla - ADR]] | `05 - Plantillas\` |
| [[Autenticación y Autorización]] · [[Row Level Security (RLS)]] · [[Cabeceras y CSP]] · [[Gestión de Secretos y Entornos]] · [[Estrategia de Testing]] | `02 - Arquitectura\`, `03 - Seguridad\`, `01 - Estándares\` |
