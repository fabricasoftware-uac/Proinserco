---
tipo: guía
estado: vigente
creado: 2026-11-18
proyecto: ProInserco
responsable: Salomón
---

# Guía rápida para Salomón

Salo: el código del backend ya está terminado y probado. Lo que falta es **configurar el servidor**. Esta guía te dice **qué** hacer y **en qué orden**, en palabras simples. Los comandos exactos y los detalles están en la guía larga, [[Pasos para Salomón en el servidor]]; cuando haga falta, aquí te digo qué paso de allá mirar.

> [!danger] Lo más importante
> **No hagas deploy de la versión nueva hasta terminar la Parte A.** La app nueva está hecha para **negarse a arrancar** si falta algo de seguridad (Redis, claves reales de Turnstile, migraciones). Si despliegas antes, la web que hoy funciona se cae.

---

## Parte A: antes de desplegar (obligatorio)

### 1. Decide dónde vive la app
- **VPS con Coolify** (lo planeado) o **Vercel** (donde está ahora).
- Si te quedas en Vercel, pon `DESPLIEGUE=vercel`.

### 2. Haz un backup de la base de datos
Una copia completa antes de tocar nada. Guárdala fuera del repo.

### 3. Aplica las 2 migraciones nuevas
- Archivos: `20261118200000_flujo_publico_funciones_acotadas.sql` y `20261118200100_auditoria_alertas_conciliacion.sql`.
- Comando: `scripts/aplicar-migraciones.sh` (por túnel SSH al puerto **5432**, no al 6543).
- **Qué cambian:** la web pública ya no puede leer la lista de donantes; solo usa unas funciones cerradas que hacen lo justo.
- **Cómo saber que salió bien:** corre las 3 consultas de verificación del paso 2 de la guía larga.

### 4. Crea el widget real de «Soy una persona» (Cloudflare Turnstile)
1. Cloudflare → **Turnstile** → **Add widget** → modo **Managed**.
2. Dominios: el dominio real de la web **y** `localhost`.
3. Copia las dos claves:
   - **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, en Vercel/Coolify **y** como *variable* del repo en GitHub (Settings → Secrets and variables → Actions → Variables).
   - **Secret Key** → `TURNSTILE_SECRET_KEY`, **solo** en el servidor.
4. `APP_URL` debe ser exactamente el dominio del widget.

> Las claves que empiezan por `1x0000…` son de **prueba** (siempre dejan pasar). En producción la app ya no arranca con ellas.

### 5. Crea un Redis
Sirve para limitar intentos (login, donaciones). Sin él, en Vercel la app no arranca.
- **VPS:** en Coolify, *New Resource* → *Database* → **Redis 7**, sin puerto público.
- **Vercel:** crea uno en **Upstash** y copia la URL que empieza por `rediss://`.
- Pon esa URL en `LIMITADOR_URL`.

### 6. Revisa las variables de entorno
Guíate por `.env.example`. Las nuevas son:

| Variable | Qué poner |
|---|---|
| `LIMITADOR_URL` | La URL del Redis (paso 5) |
| `DESPLIEGUE` | `vercel`, `directo` o `cloudflare` |
| `CRON_SECRET` | **Solo en Vercel:** el mismo valor que `CRON_CONCILIACION_SECRETO` |
| `ALERTAS_WEBHOOK_URL` | Opcional: un webhook de Slack o Discord para recibir alertas de pagos raros |

Confirma también estas, que ya existían: `ADAPTADORES=real`, `OPENPAY_SANDBOX_EN_PRODUCCION=no` (en producción real) y los secretos del webhook y del cron, con 32 caracteres o más.

---

## Parte B: despliega y configura

### 7. Despliega
- Haz el deploy.
- Si algo falta, el log dice **qué variable** es (nunca muestra su valor).
- `/api/health` debe responder 200.

### 8. Da de alta a los usuarios del panel
- Ahora el código de la app autenticadora (TOTP) se registra **al crear el usuario**, ya no en el primer login.
- Hazlo **con la persona al lado y su teléfono**:
  ```bash
  node scripts/alta-usuario-panel.mjs --correo persona@... --nombre "Nombre" --rol administrador --metodo-bd sql
  ```
- El script muestra un código (o un QR en texto) **una sola vez**. La persona lo añade a su app y escribe el primer código.
- Usuarios que ya existían: repite el comando con `--actualizar-existente --restablecer-mfa`.

### 9. Configura el webhook en Openpay
1. Panel de Openpay (primero en **sandbox**) → *Webhooks* → *Agregar*.
2. URL: `https://<dominio>/api/webhooks/openpay/<OPENPAY_WEBHOOK_SECRETO_RUTA>`.
3. Usuario y contraseña: `OPENPAY_WEBHOOK_USUARIO` y `OPENPAY_WEBHOOK_CONTRASENA`.
4. Openpay envía un código de verificación: búscalo en el log de la app y pégalo en Openpay.
5. Si la verificación falla con un error 401, avísale a Michael.

### 10. Programa la conciliación diaria
Cada día la app revisa que nuestros pagos cuadren con los de Openpay.
- **Vercel:** ya está configurado en `apps/web/vercel.json`; solo pon `CRON_SECRET`.
- **VPS:** en Coolify, una *Scheduled Task* diaria con el `curl` del paso 8 de la guía larga.

---

## Parte C: prueba antes de abrir al público

### 11. Haz donaciones de prueba (sandbox)

| Tarjeta de prueba | Resultado esperado |
|---|---|
| `4111 1111 1111 1111` | «¡Gracias por tu donación!» y **aprobada** en el panel |
| `4222 2222 2222 2220` | «No pudimos completar el pago» y **rechazada** |

Revisa también:
- Que la donación aparece en el panel y en la auditoría.
- Un reembolso desde Openpay: la donación pasa a **reembolsada**.

La lista completa de 9 pruebas está en el paso 9 de la guía larga.

### 12. Activa la protección CSP
1. Empieza con `CSP_SOLO_REPORTE=si`.
2. Haz una donación completa con la consola del navegador abierta.
3. Si no sale ningún aviso rojo de «Content Security Policy», cambia a `CSP_SOLO_REPORTE=no` y redespliega.

### 13. Si usas el VPS: cierra el servidor detrás de Cloudflare
- DNS con la **nube naranja** activada.
- SSL en **Full (strict)**.
- El firewall del VPS solo deja entrar a Cloudflare.
- Studio, la base de datos y Redis **no** se pueden abrir desde Internet.

### 14. Backups automáticos
- Una copia diaria de la base, cifrada y fuera del servidor.
- **Prueba restaurarla una vez** para saber que sirve.

### 15. Pasa a producción
- Cambia a las llaves de **producción** de Openpay.
- Pon `OPENPAY_SANDBOX_EN_PRODUCCION=no`.
- Repite una donación pequeña real.

---

## Lista para marcar

- [ ] 1. Decidido: VPS o Vercel
- [ ] 2. Backup hecho
- [ ] 3. Migraciones aplicadas y verificadas
- [ ] 4. Turnstile real creado y claves puestas
- [ ] 5. Redis creado y `LIMITADOR_URL` puesta
- [ ] 6. Variables revisadas
- [ ] 7. Desplegado y `/api/health` en 200
- [ ] 8. Usuarios del panel dados de alta con su TOTP
- [ ] 9. Webhook de Openpay verificado
- [ ] 10. Conciliación diaria programada
- [ ] 11. Donaciones de prueba OK
- [ ] 12. CSP aplicada
- [ ] 13. Cloudflare y origen cerrado (si es VPS)
- [ ] 14. Backups automáticos y probados
- [ ] 15. En producción con llaves reales

**Si algo no cuadra o un paso falla, no lo fuerces: escríbele a Michael con el error del log.**
