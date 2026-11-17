---
tipo: checklist
estado: vigente
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
---

# Checklist de Seguridad para Producción

Checklist verificable antes de salir a producción. Cada punto indica cómo comprobarlo. Complementa [[Handoff para Backend]]. Nada se marca sin evidencia.

> [!danger] **Bloqueantes**
> Sin `ADAPTADORES=real`, sin datos de demostración eliminados, sin rotar la clave de Pexels y sin origen cerrado a Cloudflare, **no se publica**.

---

## 1. Pagos

- [ ] Openpay en producción: `OPENPAY_API_URL=https://api.openpay.co` con `NODE_ENV=production` (`env.ts` falla si se mezclan con sandbox). Comprobar: arranque limpio.
- [ ] Llaves de sandbox y producción distintas; la privada solo en Coolify, sin `NEXT_PUBLIC_`.
- [ ] SAQ aplicable y respuestas a las preguntas de Openpay (Handoff 7.9) por escrito.
- [ ] Host del checkout añadido a `form-action` en `apps/web/src/server/csp.ts` y probado con un pago real de sandbox.
- [ ] Webhook registrado con HTTPS y dominio, Basic auth y secreto en la ruta; evento `verification` completado.
- [ ] Test: un aviso falso `charge.succeeded` no aprueba nada (la consulta a la API manda).
- [ ] Test: monto manipulado en el cliente es rechazado o reemplazado por el del servidor.
- [ ] La página `/donar/resultado` no cambia estados por parámetros de URL.
- [ ] Conciliación diaria funcionando y con alerta; política para donaciones `creada` abandonadas.
- [ ] Ningún PAN/CVV en logs ni BD (buscar patrón de 13-19 dígitos en logs de prueba).
- [ ] `DONACIONES_HABILITADAS` probado: con `no`, crear donación falla con mensaje público.
- [ ] Límites `DONACION_MONTO_MINIMO_COP`/`MAXIMO` confirmados con la fundación.
- [ ] E2E con tarjetas de sandbox (aprobada, rechazada, fondos insuficientes, fraude).

## 2. Autenticación y panel

- [ ] Supabase Auth: contraseña mínima 12, HIBP, confirmación de correo, redirecciones exactas sin comodines, rotación de refresh tokens.
- [ ] MFA TOTP obligatorio: un usuario con solo contraseña (aal1) no entra a ninguna página ni acción del panel.
- [ ] Rol desde `app_metadata`, nunca `user_metadata`; `getUser()` y ningún `getSession()` (buscar en el código).
- [ ] `requireActor()` en cada página/layout del panel y `accionPanel` + `conPermiso` en cada acción. Probar con `curl` sin cookie y con rol `consulta`.
- [ ] Nombres de cookie reconciliados con `src/proxy.ts` (Handoff, sección 8).
- [ ] Cookies `HttpOnly`, `Secure`, `SameSite=Strict`, prefijo `__Host-` (inspeccionar en navegador).
- [ ] Bloqueo progresivo y timeout por inactividad implementados y probados.
- [ ] Mensajes de login genéricos (mismo texto con correo inexistente).
- [ ] Panel con `Cache-Control: no-store` y `X-Robots-Tag: noindex`.
- [ ] Usuarios demo, `demo.ts`, `acciones-demo.ts` y `usuarios-demo.ts` eliminados.
- [ ] Alta de los usuarios reales del panel con su TOTP.

## 3. Datos y RLS

- [ ] RLS `ENABLE` + `FORCE` en todas las tablas, denegar por defecto.
- [ ] `auditoria` y `consentimientos`: INSERT permitido, UPDATE/DELETE rechazados incluso para el rol más alto de la app (test).
- [ ] Test de concurrencia: dos webhooks simultáneos aplican una sola transición.
- [ ] Rol de BD de mínimo privilegio para el flujo público; service role fuera de las peticiones.
- [ ] Importes `bigint` + moneda; `CHECK` de estados.
- [ ] `ip` inet: `'desconocida'` guardada como NULL.
- [ ] Documento y celular protegidos (cifrado de columna si se decide) y enmascarados; revelar queda en auditoría.
- [ ] Migraciones con `DATABASE_URL_DIRECT`; la app con el pooler y `prepare: false`.
- [ ] Datos de demostración no sembrados con `real`.
- [ ] Derecho de supresión (anonimización) probado y plazos contables validados.

## 4. Cabeceras y CSP

- [ ] Primer despliegue con `CSP_SOLO_REPORTE=si`; consola del navegador sin violaciones en `/`, `/donar`, `/acceso`, `/panel`.
- [ ] Al añadir hosts (Openpay en `form-action`) repetir en solo reporte antes de aplicar.
- [ ] Pasar a `CSP_SOLO_REPORTE=no` y verificar cabecera `Content-Security-Policy` real.
- [ ] Sin `'unsafe-inline'` ni `'unsafe-eval'` en `script-src` (el último solo existe en desarrollo).
- [ ] HSTS presente; `preload` solo cuando todos los subdominios sirvan HTTPS.
- [ ] `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP (`curl -I`).
- [ ] El HTML no se cachea en Cloudflare (sin `cf-cache-status: HIT`); ver [[ADR-0004 - CSP con nonce y páginas dinámicas]].

## 5. DDoS, bots y Cloudflare

- [ ] DNS con proxy naranja activo; sin registros grises que revelen la IP del origen.
- [ ] SSL/TLS en Full (strict).
- [ ] Origen cerrado: 80/443 solo desde rangos de Cloudflare o Cloudflare Tunnel; `curl -k https://<IP-origen>` falla.
- [ ] `DESPLIEGUE=cloudflare` solo después del punto anterior; test con `X-Forwarded-For` falso.
- [ ] Rocket Loader apagado.
- [ ] Reglas WAF y de rate limiting del borde sobre `/donar`, `/acceso` y `/api/webhooks`; revisar límites del plan contratado.
- [ ] Cache: solo `/_next/static`, `/img`, `/marca`; HTML sin caché.
- [ ] Turnstile con claves reales (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` en el build, secreto en servidor); verificar que sin token el formulario falla.
- [ ] `LIMITADOR_URL` con Redis si hay más de una instancia; fallo cerrado probado apagando Redis.
- [ ] Plan "modo bajo ataque" escrito con nombres y accesos (Under Attack Mode, interruptor `DONACIONES_HABILITADAS`).
- [ ] SSH solo con llave y desde IPs concretas.

## 6. Secretos y entornos

- [ ] Ningún secreto en el repositorio (buscar claves en el historial antes del primer commit y después).
- [ ] `.env*` ignorados salvo `.env.example`.
- [ ] Secretos distintos por entorno; `SESION_SECRETO`, contraseña de webhook y demás generados con aleatorio criptográfico.
- [ ] Ningún `NEXT_PUBLIC_` salvo la clave de sitio de Turnstile.
- [ ] **Clave de Pexels de la fase de ejemplo rotada** (la usó `scripts/pexels.mjs` y vive en `apps/web/.env.local`); revocar la anterior en la cuenta de Pexels.
- [ ] Token de deploy de Coolify solo con permiso de deploy; token de GHCR solo `read:packages`.

## 7. Cadena de suministro

- [ ] `pnpm install --frozen-lockfile` en CI; versiones exactas (`save-exact`).
- [ ] `pnpm audit:deps` sin hallazgos altos.
- [ ] Mínimos: Next >= 16.4.6, React >= 19.3.1, sharp >= 0.35.5.
- [ ] Dependabot y escaneo de secretos activos (hoy pendientes).
- [ ] Imagen Docker construida en CI, nunca en el VPS.

## 8. Código fuente

- [ ] Sin source maps en producción (`productionBrowserSourceMaps: false`; comprobar que no hay `.map` en `/_next/static`).
- [ ] `/.env`, `/.git` y similares responden 404 (el proxy los bloquea; verificar en producción).
- [ ] `poweredByHeader` apagado (sin `X-Powered-By`).
- [ ] `/api/health` no revela versión ni modo.
- [ ] Mensajes de error al cliente sin detalles internos (`requestId` solamente).

## 9. Logs, alertas y backups

- [ ] Logs JSON sin datos personales ni secretos; alertas por picos de 429, rechazos de pago y errores 5xx.
- [ ] Alerta de fallo de conciliación.
- [ ] Backups de la base activos y **restauración probada**.
- [ ] Retención de IP y de auditoría definida con la fundación.
- [ ] Seguimiento de errores configurado.

## 10. Legal

- [ ] Banner de cookies funcionando: nada no esencial antes del consentimiento; sin peticiones de terceros previas.
- [ ] Todos los `[POR DEFINIR]` de `/legal/*` resueltos (ver [[Pendientes]]).
- [ ] Textos revisados y firmados por abogado; quitar el aviso de borrador y actualizar `versionPoliticaDatos`.
- [ ] Autorización de datos no premarcada y registrada con versión, IP y fecha.
- [ ] Registro en el RNBD si aplica; decisión sobre [[ADR-0007 - Tipo y número de documento a todo donante]].
- [ ] Autorización de los aliados para usar sus logos registrada.
- [ ] Créditos de fotos de Pexels sustituidos o atribuidos.

## 11. Rendimiento y accesibilidad

- [ ] Lighthouse móvil sobre `pnpm build` + `pnpm start` contra [[ADR-0005 - Presupuesto de rendimiento para animación intensiva]].
- [ ] Accesibilidad >= 95 y auditoría axe en ambos temas del panel.

---

## Enlaces

[[Handoff para Backend]] · [[Pendientes]] · [[ProInserco]] · [[Protección contra DDoS, Bots y Abuso]] · [[Cabeceras y CSP]] · [[Gestión de Secretos y Entornos]]
