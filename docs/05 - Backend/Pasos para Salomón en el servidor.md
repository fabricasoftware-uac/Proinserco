---
tipo: guía
estado: vigente
creado: 2026-11-18
actualizado: 2026-11-18
proyecto: ProInserco
responsable: Salomón
---

# Pasos para Salomón en el servidor

Lista **ordenada** de lo que hay que hacer en el servidor después de la revisión del backend del 2026-11-18. Todo lo de código ya está hecho y probado (ver [[Handoff para Backend]], sección 0). Aquí solo queda infraestructura, configuración y pruebas en vivo. Marca cada casilla con evidencia (captura, salida del comando o enlace al log).

> [!danger] **Antes de empezar**
> - Nada de esto se hace desde un `.env` con credenciales de producción en tu portátil. Las variables viven en Coolify (o en Vercel) y los comandos se ejecutan por túnel SSH o dentro del VPS.
> - Haz el **paso 1 (backup)** antes de tocar la base de datos.
> - Plan documentado: **VPS DigitalOcean + Coolify + Cloudflare** ([[ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare]]). Si la app se queda en Vercel, sigue también los recuadros «Si te quedas en Vercel».

---

## 0. Decidir dónde corre la app

- [ ] **VPS (recomendado):** una instancia de `apps/web` en Coolify detrás de Cloudflare. `DESPLIEGUE=cloudflare` (cuando el origen esté cerrado, paso 11) o `directo`.
- [ ] **Vercel:** `DESPLIEGUE=vercel`. Cada petición puede ir a una instancia distinta, así que **`LIMITADOR_URL` es obligatoria** en producción: sin ella la app **no arranca** (error claro en el log: `LIMITADOR_URL: Obligatoria en despliegues serverless…`). Postgres (pooler) y el gateway de Supabase tienen que ser accesibles desde Vercel por Internet con TLS.

## 1. Backup antes de migrar

```bash
# Túnel SSH a la base (puerto directo 5432, nunca el pooler 6543)
ssh -N -L 15432:127.0.0.1:5432 <usuario>@<ip-vps>
export DATABASE_URL_DIRECT="postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:15432/postgres"
pg_dump "$DATABASE_URL_DIRECT" -Fc -f "proinserco-antes-20261118200000.dump"
```

- [ ] Dump guardado **fuera** del repositorio (el `.gitignore` ya ignora `*.dump`) y en un sitio cifrado.

## 2. Aplicar las migraciones nuevas

Migraciones nuevas (las cinco anteriores no se tocan):

| Migración | Qué hace |
|---|---|
| `20261118200000_flujo_publico_funciones_acotadas.sql` | Quita a `proinserco_publico` todo privilegio de tabla sobre `donantes`, `donaciones` y `donaciones_transiciones`; crea el rol `proinserco_flujo_publico` (NOLOGIN, sin BYPASSRLS), la tabla `donaciones_consultas_pasarela` y las 6 funciones `SECURITY DEFINER` acotadas del flujo público |
| `20261118200100_auditoria_alertas_conciliacion.sql` | Añade la acción de auditoría `conciliacion.alerta` (CHECK y política del rol de sistema) |

```bash
# Con el túnel del paso 1 abierto, desde la raíz del repositorio:
DATABASE_URL_DIRECT="$DATABASE_URL_DIRECT" DESDE=20261118200000 sh scripts/aplicar-migraciones.sh
```

> Base nueva (sin ninguna migración): el mismo comando **sin** `DESDE`. Con Supabase CLI también vale `supabase db push --db-url "$DATABASE_URL_DIRECT"`. **Nunca** `supabase db reset` ni `seed.sql` en el servidor.

Verificación (debe salir exactamente lo indicado):

```bash
# a) El rol público ya no ve ni toca las tablas → "permission denied"
psql "$DATABASE_URL_DIRECT" -c "BEGIN; SET LOCAL ROLE proinserco_publico; SELECT count(*) FROM public.donantes; ROLLBACK;"

# b) Las 6 funciones: SECURITY DEFINER, search_path vacío, dueño sin BYPASSRLS → 6 filas, todo t / proinserco_flujo_publico / f
psql "$DATABASE_URL_DIRECT" -c "
SELECT p.proname, p.prosecdef, p.proconfig, r.rolname, r.rolbypassrls,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede
  FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
 WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE ANY (ARRAY['%_publica%', '%_publico', 'intento_donacion_por_clave']);"

# c) RLS ENABLE + FORCE en las 10 tablas de public (ahora incluye donaciones_consultas_pasarela)
psql "$DATABASE_URL_DIRECT" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY 1;"
```

- [ ] a) falla con `permission denied for table donantes`.
- [ ] b) 6 filas correctas y `anon_puede = f`.
- [ ] c) 10 tablas con `t | t`.
- [ ] Si `GRANT proinserco_flujo_publico TO CURRENT_USER` o `ALTER FUNCTION … OWNER` fallan por permisos, aplica la migración con el usuario `postgres` del contenedor `db` (es quien creó los roles). Nunca con `supabase_admin` desde fuera.

## 3. Variables de entorno nuevas o cambiadas

En el recurso de `apps/web` en Coolify (o en el proyecto de Vercel). Plantilla y comentarios: `.env.example`.

| Variable | Valor | Notas |
|---|---|---|
| `LIMITADOR_URL` | `redis://default:<clave>@<host-redis-interno>:6379` (VPS) o `rediss://default:<token>@<host>.upstash.io:6379` (Vercel) | Obligatoria en Vercel; en VPS con una instancia es opcional pero recomendable (paso 4) |
| `DESPLIEGUE` | `cloudflare` · `directo` · `vercel` | `vercel` es nuevo |
| `ALERTAS_WEBHOOK_URL` | `https://hooks.slack.com/services/…` (o Discord, Google Chat, n8n, relay de correo) | Opcional y **secreta**. Sin ella las alertas de conciliación solo van al log y a la auditoría |
| `CRON_SECRET` | El **mismo** valor que `CRON_CONCILIACION_SECRETO` | **Solo en Vercel** (Vercel Cron lo envía como `Bearer`) |
| Variable del **repositorio** GitHub `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave de sitio real del widget de Cloudflare | Settings → Secrets and variables → Actions → **Variables**. Sin ella (o con la de pruebas `1x000…AA`) el job `docker` **falla a propósito**. En Vercel: variable del proyecto para *Production* |

Ya existentes que hay que confirmar: `ADAPTADORES=real`, `OPENPAY_SANDBOX_EN_PRODUCCION=no` en producción, `CRON_CONCILIACION_SECRETO` (≥ 32 caracteres), `OPENPAY_WEBHOOK_SECRETO_RUTA` (≥ 32), `OPENPAY_WEBHOOK_USUARIO`, `OPENPAY_WEBHOOK_CONTRASENA`.

- [ ] Variables definidas. Al desplegar, el contenedor arranca (si falta algo obligatorio, `src/instrumentation.ts` detiene el arranque y el log dice **qué** variable, nunca su valor).

## 3 bis. Crear el widget de Turnstile y poner las claves REALES

> [!warning] Parece que el entorno actual usa las claves de **prueba** de Cloudflare. En producción la app ya **no arranca** con ellas (`1x0000…`, `2x0000…`, `3x0000…`) ni con la casilla de demostración (`ANTIBOTS=memoria`), y el build de producción falla sin la clave de sitio real.

1. Cloudflare → *Turnstile* → *Add widget*. Nombre: «Proinserco – donar». Modo **Managed**.
2. *Hostnames*: el dominio real (p. ej. `proinserco.org` y `www.proinserco.org`) **y** `localhost` para pruebas locales. Si hay staging, también su dominio.
3. Copiar la **Site Key** y la **Secret Key**.
4. Site Key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: en GitHub como **variable del repositorio** (el job `docker` la pasa como `--build-arg`; se incrusta en el build) y, si quieres que el servidor también la valide al arrancar, igual en las variables del recurso de Coolify. En Vercel: variable del proyecto en *Production*.
5. Secret Key → `TURNSTILE_SECRET_KEY` solo en el servidor (Coolify / Vercel). Nunca con `NEXT_PUBLIC_`.
6. `ANTIBOTS=turnstile` (es el valor por defecto con `ADAPTADORES=real`) y `ANTIBOTS_MEMORIA_EN_PRODUCCION=no`.
7. `APP_URL` debe tener exactamente el hostname del widget: el servidor rechaza tokens cuyo `hostname` no coincida.

Pruebas locales con las claves de prueba oficiales (solo fuera de producción): sitio `1x00000000000000000000AA` (siempre pasa) o `2x00000000000000000000AB` (siempre falla); secretos `1x0000000000000000000000000000000AA` (siempre pasa) y `2x0000000000000000000000000000000AA` (siempre falla).

- [ ] En `/donar`, paso 3: aparece el widget oficial de Cloudflare (respeta el tema), el botón «Continuar al pago seguro» está deshabilitado hasta resolverlo y, al pagar, el log no muestra `Verificación Turnstile fallida`.
- [ ] Repetir el envío con el mismo token (p. ej. reenviando la petición) → «No pudimos verificar que eres una persona».
- [ ] La consola del navegador no muestra violaciones de CSP por `challenges.cloudflare.com`.

## 4. Crear Redis y fijar `LIMITADOR_URL`

**VPS (Coolify):**

1. Coolify → *New Resource* → *Database* → **Redis 7**, en la **misma red** que `apps/web`.
2. Contraseña larga generada por Coolify. **Sin** puerto público (no marcar *Make it publicly available*).
3. `LIMITADOR_URL=redis://default:<clave>@<nombre-del-servicio>:6379` en `apps/web`.
4. Persistencia: no hace falta (son contadores con caducidad).

**Si te quedas en Vercel:** Upstash → base Redis en la región más cercana a la de las funciones → copiar la URL **TLS** (`rediss://…`). Se admite tal cual; el adaptador amplía los timeouts para TLS (3 s conexión, 1 s comando).

Prueba de fallo cerrado:

- [ ] Con Redis parado, `/acceso` y el formulario de donar responden «Demasiadas peticiones» (fallo **cerrado**), el webhook sigue respondiendo y `/donar/resultado` sigue mostrando el estado (fallo abierto a propósito en esos dos).
- [ ] Redis arrancado de nuevo: todo vuelve a funcionar sin reiniciar la app.

## 5. Desplegar la imagen nueva

- [ ] El *push* a `main` pasa `verify` **e** `integracion` (Postgres + Redis efímeros, 0 tests saltados) antes de publicar la imagen en GHCR.
- [ ] Coolify despliega la imagen nueva; `/api/health` responde 200.
- [ ] En staging con `ADAPTADORES=real`: `GET /donar/pasarela-simulada?cargo=x` responde **404**.

## 6. Dar de alta a los usuarios del panel (con su TOTP)

El TOTP ya **no** se puede registrar desde el login. Cada persona se da de alta con el script, **delante de ti y con su teléfono**:

```bash
# Túneles: gateway de Supabase (Kong/Envoy) y base de datos
ssh -N -L 18000:<api-gw>:8000 -L 15432:127.0.0.1:5432 <usuario>@<ip-vps>

export SUPABASE_URL="http://127.0.0.1:18000"
export SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"   # solo en esta terminal
export SUPABASE_ANON_KEY="<ANON_KEY>"
export DATABASE_URL_DIRECT="postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:15432/postgres"

node scripts/alta-usuario-panel.mjs --correo persona@proinserco.org --nombre "Nombre Apellido" --rol administrador --metodo-bd sql
```

El script: pide la contraseña inicial (oculta, ≥ 12 caracteres) → crea el usuario → sincroniza `usuario_roles` y `perfiles` → **muestra una sola vez** la clave y el URI `otpauth://` → la persona los añade a su app → escribe el primer código → queda verificado y se cierran sus sesiones.

- [ ] Cada usuario real dado de alta con `mfa: "totp_verificado"` en el resumen JSON.
- [ ] Usuarios creados **antes** de esta revisión (por invitación o sin TOTP verificado): `--actualizar-existente --restablecer-mfa` (fija contraseña nueva, borra factores, enrola TOTP nuevo).
- [ ] Prueba: entrar en `/acceso` con correo + contraseña + código → panel. Un usuario sin TOTP ve «Pide al administrador que active tu acceso».
- [ ] `unset SUPABASE_SERVICE_ROLE_KEY` y cerrar la terminal; no queda nada en el historial (la contraseña nunca va en argumentos).

## 7. Webhook en el panel de Openpay

1. Dashboard de Openpay (sandbox primero) → *Webhooks* → *Agregar*.
2. URL: `https://<dominio>/api/webhooks/openpay/<OPENPAY_WEBHOOK_SECRETO_RUTA>` (HTTPS con dominio, nunca una IP).
3. Autenticación básica: `OPENPAY_WEBHOOK_USUARIO` / `OPENPAY_WEBHOOK_CONTRASENA`.
4. Eventos: `charge.succeeded`, `charge.failed`, `charge.cancelled`, `charge.refunded`, `chargeback.created`, `chargeback.accepted`, `chargeback.rejected` (y `charge.created` si lo ofrece).
5. Openpay envía `verification`: el código aparece en el log de la app (`Webhook Openpay: código de verificación recibido`). Introdúcelo en el dashboard.

- [ ] Webhook verificado. Si el `verification` llega **sin** Basic auth y la app responde 401, anótalo y escríbelo a Michael (Handoff 7.4, «Verificar»).
- [ ] Repetir en producción con las llaves de producción.

## 8. Cron de conciliación diaria

**VPS (Coolify):** recurso `apps/web` → *Scheduled Tasks* → diaria `0 8 * * *` (03:00 en Bogotá):

```bash
curl -fsS -X POST "https://<dominio>/api/cron/conciliacion" -H "Authorization: Bearer ${CRON_CONCILIACION_SECRETO}"
```

**Si te quedas en Vercel:** `apps/web/vercel.json` ya programa `GET /api/cron/conciliacion` a las 08:00 UTC. Define `CRON_SECRET` con el mismo valor que `CRON_CONCILIACION_SECRETO`. Si el *Root Directory* del proyecto en Vercel no es `apps/web`, mueve `vercel.json` a esa raíz. En el plan Hobby Vercel solo garantiza ejecución diaria (con margen de una hora).

La respuesta es un JSON: `revisadas`, `actualizadas`, `expiradas`, `discrepancias`, `errores`, `cargosCruzados`.

- [ ] Ejecución manual con `curl` → 200 y JSON. Sin Bearer → 401.
- [ ] Con discrepancias o errores aparece `conciliacion.alerta` en `/panel/auditoria` (severidad en detalles) y llega el aviso a `ALERTAS_WEBHOOK_URL`.
- [ ] Monitoreo externo (Uptime Kuma, Healthchecks.io…) que avise si el cron **no** corre un día.

## 9. Pruebas de punta a punta en sandbox

Con `OPENPAY_API_URL=https://sandbox-api.openpay.co` (en `NODE_ENV=production` hace falta `OPENPAY_SANDBOX_EN_PRODUCCION=si`, **solo** durante estas pruebas):

| # | Prueba | Esperado |
|---|---|---|
| 1 | Donar con `4111111111111111` | Redirige al checkout de Openpay → vuelve a `/donar/resultado` → «¡Gracias por tu donación!» (por webhook o consulta) y `aprobada` en el panel |
| 2 | `4222222222222220` (rechazada) | «No pudimos completar el pago»; `rechazada` |
| 3 | `4444444444444448` (fondos insuficientes) y `4000000000000044` (fraude) | Rechazadas; ningún dato de tarjeta en logs |
| 4 | Recargar `/donar/resultado` de una donación pendiente muchas veces seguidas | Como mucho 1 consulta a Openpay cada 30 s por donación (tabla `donaciones_consultas_pasarela`); a partir de 60 cargas en 5 min desde la misma IP → página de error |
| 5 | `curl` al webhook con Basic auth correcta y `{"type":"charge.succeeded","transaction":{"id":"<id-de-un-cargo-pendiente>"}}` sin pagar | **No** aprueba nada (manda la consulta a Openpay) |
| 6 | Donar dos veces con el mismo documento y datos de contacto distintos | El donante conserva los datos de la **primera** vez; la segunda donación queda asociada a él |
| 7 | Si queda alguna donación `creada` sin cargo de hace más de 1 h (Openpay falló al crear el cargo), lanzar el cron | Se marca `expirada` solo si Openpay no tiene cargo con ese `order_id`; si lo tiene, toma su estado real |
| 8 | Reembolso desde el dashboard de Openpay | `reembolsada` tras el webhook o el cron |
| 9 | `GET /v1/<merchant>/charges?order_id=<DON-…>` con la llave privada (curl) | Devuelve solo ese cargo. Si devuelve otros, avisa: el adaptador ya filtra en cliente, pero hay que anotarlo (Handoff 7.9) |

- [ ] Las 9 pruebas con evidencia. Después: `OPENPAY_SANDBOX_EN_PRODUCCION=no` y llaves de producción.

## 10. CSP: de solo reporte a aplicada

1. Primer despliegue con `CSP_SOLO_REPORTE=si`.
2. Recorrer `/`, `/donar` (los 3 pasos, con Turnstile), el checkout de Openpay y la vuelta, `/acceso`, `/panel` y sus páginas, con la consola del navegador abierta.
3. Si aparece una violación por el host real del checkout en `form-action`: definir `OPENPAY_CHECKOUT_ORIGIN=https://<host-del-checkout>` y repetir.
4. Sin violaciones durante una donación completa: `CSP_SOLO_REPORTE=no`, redesplegar.

- [ ] `curl -sI https://<dominio>/ | grep -i content-security-policy` muestra `Content-Security-Policy` (no `-Report-Only`).

## 11. Cloudflare y origen cerrado

- [ ] DNS con proxy naranja en el dominio y en `www`; ningún registro gris que apunte al VPS.
- [ ] SSL/TLS en **Full (strict)**; certificado de origen válido en Traefik/Coolify.
- [ ] Firewall del VPS (DigitalOcean Cloud Firewall o `ufw`): 80/443 **solo** desde los rangos de Cloudflare (`https://www.cloudflare.com/ips-v4` y `-v6`), o Cloudflare Tunnel sin puertos abiertos. SSH solo con llave y desde IPs concretas.
- [ ] Desde fuera: `curl -k https://<IP-del-VPS>` falla o agota el tiempo.
- [ ] Solo entonces `DESPLIEGUE=cloudflare`. Prueba: una petición con `X-Forwarded-For` falso no evita el límite de tasa.
- [ ] Rocket Loader apagado; caché solo para `/_next/static`, `/img` y `/marca` (HTML sin caché: sin `cf-cache-status: HIT`).
- [ ] Reglas WAF / rate limiting del borde sobre `/donar`, `/acceso` y `/api/webhooks`.
- [ ] Studio, `meta`, el gateway de Supabase y Redis **no** son accesibles desde Internet.

## 12. Backups

- [ ] Backup diario de Postgres programado (Coolify *Backups* de la base hacia S3/Spaces, o `pg_dump -Fc` por cron) con retención (p. ej. 7 diarios + 4 semanales), **cifrado** y fuera del VPS.
- [ ] **Restauración probada** en una base vacía: `pg_restore` + `SELECT count(*) FROM public.donaciones` coincide y la app arranca contra ella.
- [ ] Los volúmenes de Coolify (configuración) también entran en la copia.
- [ ] Retención de IP y de auditoría acordada con la fundación (Checklist, sección 9).

---

## Enlaces

[[Handoff para Backend]] · [[Checklist de Seguridad para Producción]] · [[Servicios Supabase para VPS]] · [[Pendientes]] · [[ADR-0003 - Despliegue en VPS DigitalOcean con Coolify tras Cloudflare]]
