#!/usr/bin/env node
// Alta administrativa de usuarios del panel de Proinserco (Node puro, sin dependencias).
//
// El segundo factor (TOTP) se ENROLA AQUÍ, en el alta, nunca desde el login: quien robe
// una contraseña no puede registrar su propio TOTP (la app rechaza cuentas sin factor
// verificado con «Pide al administrador que active tu acceso»).
//
// Uso:
//   1. Alta nueva (pide la contraseña inicial por TTY oculto o ALTA_USUARIO_CONTRASENA):
//      node --env-file=<archivo-env-del-servidor> scripts/alta-usuario-panel.mjs \
//        --correo persona@proinserco.org --nombre "Nombre Apellido" --rol consulta
//      → crea el usuario, registra el TOTP, muestra UNA vez el secreto y el URI otpauth://
//        para escanearlo/escribirlo en la app autenticadora y verifica un primer código.
//
//   2. Cambiar rol o nombre de alguien que ya existe (sin tocar su TOTP):
//      ... --correo persona@proinserco.org --nombre "Nuevo Nombre" --rol administrador --actualizar-existente
//
//   3. Teléfono perdido / reactivar el acceso: borra TODOS sus factores, fija una contraseña
//      nueva, enrola un TOTP nuevo y cierra todas sus sesiones:
//      ... --correo persona@proinserco.org --nombre "Nombre" --rol consulta --actualizar-existente --restablecer-mfa
//
//   En el VPS sin PostgREST (`rest` desactivado) se sincroniza IAM con `psql` y
//   DATABASE_URL_DIRECT (modo `auto` lo detecta; o forzar con `--metodo-bd sql`).
//
// Seguridad:
//   - Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (NUNCA en el navegador ni en logs).
//   - El secreto TOTP solo se imprime en la terminal (nunca en el resumen JSON ni en archivos).
//   - Registra el rol en `public.usuario_roles` (fuente de verdad del hook JWT) y el
//     nombre visible en `public.perfiles`.

import { execFileSync, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'

const ROLES_VALIDOS = new Set(['administrador', 'consulta'])
const METODOS_BD_VALIDOS = new Set(['auto', 'sql', 'rest'])
const ESTADOS_POSTGREST_AUSENTE = new Set([404, 502, 503])
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTROL_CHARS_REGEX = /[\p{Cc}]/u
const CODIGO_TOTP_REGEX = /^\d{6}$/
const INTENTOS_CODIGO = 3
const NOMBRE_FACTOR = 'Panel Proinserco'

function imprimirAyuda() {
  console.log(`Uso:
  node --env-file=<archivo-env> scripts/alta-usuario-panel.mjs [opciones]

Opciones obligatorias:
  --correo <email>          Correo del usuario (se normaliza a minúsculas)
  --nombre <texto>          Nombre visible en el panel (2 a 120 caracteres)
  --rol <rol>               Rol en el panel: administrador | consulta

Opciones adicionales:
  --actualizar-existente    Si el correo ya existe en Auth, actualiza su rol y perfil (no toca su TOTP)
  --restablecer-mfa         Con --actualizar-existente: borra sus factores, fija contraseña nueva,
                            enrola un TOTP nuevo y cierra todas sus sesiones (teléfono perdido)
  --metodo-bd <metodo>      auto (por defecto) | sql | rest
                              - auto: usa psql si DATABASE_URL_DIRECT y psql existen; si no,
                                intenta PostgREST (/rest/v1) y cae a psql o imprime el SQL si
                                PostgREST responde 404/502/503.
                              - sql:  sincroniza directo con psql usando DATABASE_URL_DIRECT.
                              - rest: sincroniza vía PostgREST (/rest/v1).
  -h, --ayuda               Muestra esta ayuda

Variables de entorno:
  SUPABASE_URL              Obligatoria. URL de Supabase (ej. http://127.0.0.1:18000 por túnel SSH)
  SUPABASE_SERVICE_ROLE_KEY Obligatoria. Clave de servicio de Supabase (NUNCA exponer en cliente)
  SUPABASE_ANON_KEY         Opcional. apikey para las llamadas como el propio usuario (enrolar TOTP)
  DATABASE_URL_DIRECT       Opcional (obligatoria con --metodo-bd sql o cuando PostgREST está desactivado)
  ALTA_USUARIO_CONTRASENA   Opcional. Contraseña inicial (12 a 256 caracteres); si falta, se pide por TTY oculto`)
}

export function parsearArgumentos(argv) {
  const opciones = {
    correo: '',
    nombre: '',
    rol: '',
    metodoBd: 'auto',
    actualizarExistente: false,
    restablecerMfa: false,
    ayuda: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--ayuda') {
      opciones.ayuda = true
      continue
    }
    if (arg === '--actualizar-existente') {
      opciones.actualizarExistente = true
      continue
    }
    if (arg === '--restablecer-mfa') {
      opciones.restablecerMfa = true
      continue
    }
    if (arg === '--contrasena' || arg.startsWith('--contrasena=')) {
      throw new Error(
        'Por seguridad no se admite --contrasena en argumentos CLI (queda en el historial de shell). Usa prompt interactivo o ALTA_USUARIO_CONTRASENA.',
      )
    }

    const [clave, valorInline] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined]
    const valor = valorInline ?? argv[++i]
    if (valor === undefined) throw new Error(`Falta el valor para la opción ${clave}`)

    if (clave === '--correo' || clave === '--email') opciones.correo = valor
    else if (clave === '--nombre') opciones.nombre = valor
    else if (clave === '--rol') opciones.rol = valor
    else if (clave === '--metodo-bd') opciones.metodoBd = valor
    else if (clave === '--modo') {
      // El modo `invitacion` se retiró: el usuario invitado enrolaba el TOTP en su primer
      // login solo con la contraseña. Ahora el alta siempre fija contraseña y enrola el TOTP.
      if (valor !== 'contrasena') {
        throw new Error('El modo "invitacion" ya no existe: el alta fija la contraseña y enrola el TOTP aquí mismo.')
      }
    } else throw new Error(`Opción desconocida: ${clave}`)
  }

  return opciones
}

export function validarEntrada(opciones) {
  const correo = opciones.correo.trim().toLowerCase()
  if (correo.length < 3 || correo.length > 254 || !CORREO_REGEX.test(correo)) {
    throw new Error('El --correo no es válido (máximo 254 caracteres).')
  }

  const nombre = opciones.nombre.trim()
  if (nombre.length < 2 || nombre.length > 120 || CONTROL_CHARS_REGEX.test(nombre)) {
    throw new Error('El --nombre debe tener entre 2 y 120 caracteres imprimibles (sin saltos de línea ni control).')
  }

  if (!ROLES_VALIDOS.has(opciones.rol)) {
    throw new Error('El --rol debe ser "administrador" o "consulta".')
  }

  if (!METODOS_BD_VALIDOS.has(opciones.metodoBd)) {
    throw new Error('El --metodo-bd debe ser "auto", "sql" o "rest".')
  }

  if (opciones.restablecerMfa && !opciones.actualizarExistente) {
    throw new Error('--restablecer-mfa solo se usa junto a --actualizar-existente (sobre un usuario que ya existe).')
  }

  return {
    correo,
    nombre,
    rol: opciones.rol,
    metodoBd: opciones.metodoBd,
    actualizarExistente: opciones.actualizarExistente,
    restablecerMfa: opciones.restablecerMfa,
  }
}

function validarUuid(userId) {
  if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
    throw new Error('Supabase Auth devolvió un identificador de usuario no válido.')
  }
  return userId
}

async function leerContrasenaOculta() {
  const desdeEnv = process.env.ALTA_USUARIO_CONTRASENA
  if (desdeEnv) {
    if (desdeEnv.length < 12 || desdeEnv.length > 256) {
      throw new Error('ALTA_USUARIO_CONTRASENA debe tener entre 12 y 256 caracteres.')
    }
    return desdeEnv
  }

  if (!process.stdin.isTTY) {
    const linea = await leerLinea('')
    if (linea.length < 12 || linea.length > 256) {
      throw new Error('La contraseña debe tener entre 12 y 256 caracteres.')
    }
    return linea
  }

  process.stdout.write('Contraseña inicial (>= 12 caracteres, entrada oculta): ')
  return await new Promise((resolve, reject) => {
    const stdin = process.stdin
    const estabaEnRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let buffer = ''
    const limpiar = () => {
      stdin.setRawMode(Boolean(estabaEnRaw))
      stdin.pause()
      stdin.removeListener('data', alRecibirDatos)
    }

    const alRecibirDatos = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          limpiar()
          process.stdout.write('\n')
          reject(new Error('Operación cancelada por el usuario.'))
          return
        }
        if (ch === '\r' || ch === '\n') {
          limpiar()
          process.stdout.write('\n')
          if (buffer.length < 12 || buffer.length > 256) {
            reject(new Error('La contraseña debe tener entre 12 y 256 caracteres.'))
            return
          }
          resolve(buffer)
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          buffer = buffer.slice(0, -1)
        } else {
          buffer += ch
        }
      }
    }

    stdin.on('data', alRecibirDatos)
  })
}

async function leerLinea(pregunta) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) })
  try {
    return (await rl.question(pregunta)).trim()
  } finally {
    rl.close()
  }
}

/**
 * Petición a Supabase (GoTrue/PostgREST). `apikey` va siempre; `bearer` es la clave de
 * servicio (administración) o el access token del propio usuario (enrolar su TOTP).
 */
export async function peticionSupabase(url, apikey, opciones = {}, fetchImpl = fetch) {
  const respuesta = await fetchImpl(url, {
    method: opciones.method ?? 'GET',
    headers: {
      apikey,
      Authorization: `Bearer ${opciones.bearer ?? apikey}`,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  const texto = await respuesta.text()
  let datos = null
  if (texto) {
    try {
      datos = JSON.parse(texto)
    } catch {
      datos = { raw: texto }
    }
  }
  return { ok: respuesta.ok, status: respuesta.status, datos }
}

function detalleError(res) {
  return res.datos?.msg || res.datos?.message || res.datos?.error_description || `HTTP ${res.status}`
}

async function buscarUsuarioPorCorreo(urlBase, serviceRoleKey, correo) {
  for (let pagina = 1; pagina <= 50; pagina += 1) {
    const res = await peticionSupabase(`${urlBase}/auth/v1/admin/users?page=${pagina}&per_page=100`, serviceRoleKey)
    if (!res.ok) {
      throw new Error(`No se pudo consultar usuarios en Auth (HTTP ${res.status}).`)
    }
    const usuarios = res.datos?.users ?? []
    const encontrado = usuarios.find((u) => u.email?.toLowerCase() === correo)
    if (encontrado) return encontrado
    if (usuarios.length < 100) break
  }
  return null
}

/**
 * Crea el usuario con contraseña (o, con --actualizar-existente, actualiza rol y nombre).
 * Devuelve la contraseña solo cuando el script la conoce (alta nueva o restablecimiento):
 * hace falta para iniciar sesión como el usuario y enrolar su TOTP.
 */
async function crearOActualizarUsuario(urlBase, serviceRoleKey, entrada) {
  const existente = entrada.actualizarExistente ? await buscarUsuarioPorCorreo(urlBase, serviceRoleKey, entrada.correo) : null

  if (existente?.id) {
    const userId = validarUuid(existente.id)
    const cuerpo = { app_metadata: { rol: entrada.rol }, user_metadata: { nombre: entrada.nombre } }
    let contrasena = null
    if (entrada.restablecerMfa) {
      contrasena = await leerContrasenaOculta()
      cuerpo.password = contrasena
      await borrarFactoresComoAdmin(urlBase, serviceRoleKey, userId)
    }
    const actualizacion = await peticionSupabase(`${urlBase}/auth/v1/admin/users/${userId}`, serviceRoleKey, {
      method: 'PUT',
      body: cuerpo,
    })
    if (!actualizacion.ok) {
      throw new Error(`No se pudo actualizar el usuario existente en Auth (HTTP ${actualizacion.status}).`)
    }
    return { userId, creado: false, contrasena }
  }

  const contrasena = await leerContrasenaOculta()
  const respuesta = await peticionSupabase(`${urlBase}/auth/v1/admin/users`, serviceRoleKey, {
    method: 'POST',
    body: {
      email: entrada.correo,
      password: contrasena,
      email_confirm: true,
      user_metadata: { nombre: entrada.nombre },
      app_metadata: { rol: entrada.rol },
    },
  })

  if (respuesta.ok && respuesta.datos?.id) {
    return { userId: validarUuid(respuesta.datos.id), creado: true, contrasena }
  }
  if (respuesta.status === 422) {
    throw new Error(
      `El correo ${entrada.correo} ya existe en Auth. Usa --actualizar-existente (y --restablecer-mfa si hay que reactivar su TOTP).`,
    )
  }
  throw new Error(`Error al registrar usuario en Supabase Auth: ${detalleError(respuesta)}`)
}

/** Teléfono perdido: borra todos los factores MFA del usuario con la API de administración. */
async function borrarFactoresComoAdmin(urlBase, serviceRoleKey, userId) {
  const res = await peticionSupabase(`${urlBase}/auth/v1/admin/users/${userId}/factors`, serviceRoleKey)
  if (!res.ok) throw new Error(`No se pudieron listar los factores MFA del usuario (HTTP ${res.status}).`)
  const factores = Array.isArray(res.datos) ? res.datos : (res.datos?.factors ?? [])
  for (const factor of factores) {
    const borrado = await peticionSupabase(`${urlBase}/auth/v1/admin/users/${userId}/factors/${factor.id}`, serviceRoleKey, {
      method: 'DELETE',
    })
    if (!borrado.ok) throw new Error(`No se pudo borrar un factor MFA del usuario (HTTP ${borrado.status}).`)
  }
}

/**
 * Enrola y VERIFICA el TOTP del usuario iniciando sesión como él (la API de administración
 * de Supabase no enrola factores). Muestra el secreto y el URI otpauth:// UNA sola vez
 * por `mostrar` y pide el primer código con `pedirCodigo`. Al terminar cierra todas sus
 * sesiones (la del script incluida). Si no se verifica, borra el factor a medio crear.
 *
 * @param {{
 *   urlBase: string, apikey: string, correo: string, contrasena: string,
 *   pedirCodigo: (intento: number) => Promise<string>, mostrar: (texto: string) => void,
 *   fetchImpl?: typeof fetch, intentos?: number,
 * }} p
 */
export async function enrolarTotp(p) {
  const pedir = (url, opciones = {}) => peticionSupabase(url, p.apikey, opciones, p.fetchImpl)
  const sesion = await pedir(`${p.urlBase}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    bearer: p.apikey,
    body: { email: p.correo, password: p.contrasena },
  })
  if (!sesion.ok || !sesion.datos?.access_token) {
    throw new Error(`No se pudo iniciar sesión como el usuario para enrolar su TOTP: ${detalleError(sesion)}`)
  }
  let token = sesion.datos.access_token

  try {
    // Restos de intentos anteriores: factores sin verificar del propio usuario.
    const usuario = await pedir(`${p.urlBase}/auth/v1/user`, { bearer: token })
    const factores = usuario.datos?.factors ?? []
    if (factores.some((f) => f.factor_type === 'totp' && f.status === 'verified')) {
      throw new Error('El usuario ya tiene un TOTP verificado. Para reemplazarlo usa --actualizar-existente --restablecer-mfa.')
    }
    for (const f of factores) {
      await pedir(`${p.urlBase}/auth/v1/factors/${f.id}`, { method: 'DELETE', bearer: token })
    }

    const alta = await pedir(`${p.urlBase}/auth/v1/factors`, {
      method: 'POST',
      bearer: token,
      body: { factor_type: 'totp', friendly_name: NOMBRE_FACTOR },
    })
    const factorId = alta.datos?.id
    const secreto = alta.datos?.totp?.secret
    const uri = alta.datos?.totp?.uri
    if (!alta.ok || !factorId || !secreto || !uri) {
      throw new Error(`No se pudo crear el factor TOTP: ${detalleError(alta)}`)
    }

    p.mostrar(
      [
        '',
        '════════════════ SEGUNDO FACTOR (se muestra UNA sola vez) ════════════════',
        ' Escanea o escribe esto en la app autenticadora de la persona (Google',
        ' Authenticator, Aegis, 1Password…). No lo copies a chats, correos ni archivos.',
        '',
        ` Clave manual: ${secreto}`,
        ` URI:          ${uri}`,
        '══════════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )

    const intentos = p.intentos ?? INTENTOS_CODIGO
    for (let intento = 1; intento <= intentos; intento += 1) {
      const codigo = (await p.pedirCodigo(intento)).replace(/\s/g, '')
      if (!CODIGO_TOTP_REGEX.test(codigo)) {
        p.mostrar('El código debe tener 6 dígitos.')
        continue
      }
      const desafio = await pedir(`${p.urlBase}/auth/v1/factors/${factorId}/challenge`, {
        method: 'POST',
        bearer: token,
        body: {},
      })
      if (!desafio.ok || !desafio.datos?.id) throw new Error(`No se pudo crear el desafío MFA: ${detalleError(desafio)}`)
      const verificacion = await pedir(`${p.urlBase}/auth/v1/factors/${factorId}/verify`, {
        method: 'POST',
        bearer: token,
        body: { challenge_id: desafio.datos.id, code: codigo },
      })
      if (verificacion.ok) {
        token = verificacion.datos?.access_token ?? token
        return { factorId }
      }
      p.mostrar('Código incorrecto o caducado. Espera al siguiente código de la app e inténtalo de nuevo.')
    }

    await pedir(`${p.urlBase}/auth/v1/factors/${factorId}`, { method: 'DELETE', bearer: token })
    throw new Error(
      'No se verificó el TOTP. El usuario queda SIN acceso al panel; repite con --actualizar-existente --restablecer-mfa.',
    )
  } finally {
    // Cierra la sesión del script y cualquier otra del usuario.
    await pedir(`${p.urlBase}/auth/v1/logout?scope=global`, { method: 'POST', bearer: token }).catch(() => undefined)
  }
}

function psqlDisponible() {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore', shell: false, timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

function construirEntornoPsql(databaseUrlDirect) {
  let url
  try {
    url = new URL(databaseUrlDirect)
  } catch {
    return { env: { ...process.env }, dbnameArg: databaseUrlDirect }
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return { env: { ...process.env }, dbnameArg: databaseUrlDirect }
  }

  const env = { ...process.env }
  if (url.hostname) env.PGHOST = decodeURIComponent(url.hostname)
  if (url.port) env.PGPORT = url.port
  if (url.username) env.PGUSER = decodeURIComponent(url.username)
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password)
  const baseDatos = url.pathname.replace(/^\//, '')
  if (baseDatos) env.PGDATABASE = decodeURIComponent(baseDatos)

  const parametrosDesconocidos = []
  for (const [clave, valor] of url.searchParams.entries()) {
    if (clave === 'sslmode') env.PGSSLMODE = valor
    else if (clave === 'sslrootcert') env.PGSSLROOTCERT = valor
    else if (clave === 'options') env.PGOPTIONS = valor
    else parametrosDesconocidos.push(clave)
  }

  if (parametrosDesconocidos.length > 0) {
    return { env: { ...process.env }, dbnameArg: databaseUrlDirect }
  }
  return { env, dbnameArg: null }
}

function sincronizarPorPsql(databaseUrlDirect, userId, entrada) {
  const uidValidado = validarUuid(userId)
  if (!ROLES_VALIDOS.has(entrada.rol)) {
    throw new Error('Rol inválido para sincronización SQL.')
  }

  // Variables `-v` en psql con sintaxis `:'var'` en stdin: psql aplica
  // PQescapeLiteral internamente sin interpolación en shell ni en SQL.
  const sql = `BEGIN;
INSERT INTO public.usuario_roles (user_id, rol)
VALUES (:'uid'::uuid, :'rol')
ON CONFLICT (user_id) DO UPDATE
  SET rol = EXCLUDED.rol,
      actualizado_en = now();

INSERT INTO public.perfiles (user_id, nombre)
VALUES (:'uid'::uuid, :'nombre')
ON CONFLICT (user_id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      actualizado_en = now();
COMMIT;
`

  const { env, dbnameArg } = construirEntornoPsql(databaseUrlDirect)
  const args = [
    '-X',
    '-q',
    '--set=ON_ERROR_STOP=1',
    '--set',
    `uid=${uidValidado}`,
    '--set',
    `rol=${entrada.rol}`,
    '--set',
    `nombre=${entrada.nombre}`,
  ]
  if (dbnameArg) args.push('--dbname', dbnameArg)

  const resultado = spawnSync('psql', args, {
    input: sql,
    encoding: 'utf8',
    shell: false,
    env,
    timeout: 15_000,
  })

  if (resultado.error) {
    throw new Error(`No se pudo ejecutar psql: ${resultado.error.message}`)
  }
  if (resultado.status !== 0) {
    const detalle = resultado.stderr?.trim() || `código de salida ${resultado.status}`
    throw new Error(`Falló la sincronización SQL vía psql: ${detalle}`)
  }
}

async function sincronizarPorRest(urlBase, serviceRoleKey, userId, entrada) {
  const cabeceraUpsert = { Prefer: 'resolution=merge-duplicates,return=minimal' }

  const resRol = await peticionSupabase(`${urlBase}/rest/v1/usuario_roles?on_conflict=user_id`, serviceRoleKey, {
    method: 'POST',
    headers: cabeceraUpsert,
    body: { user_id: userId, rol: entrada.rol },
  })
  if (!resRol.ok) {
    const error = new Error(`Falló upsert en public.usuario_roles (HTTP ${resRol.status}).`)
    error.httpStatus = resRol.status
    throw error
  }

  const resPerfil = await peticionSupabase(`${urlBase}/rest/v1/perfiles?on_conflict=user_id`, serviceRoleKey, {
    method: 'POST',
    headers: cabeceraUpsert,
    body: { user_id: userId, nombre: entrada.nombre },
  })
  if (!resPerfil.ok) {
    const error = new Error(`Falló upsert en public.perfiles (HTTP ${resPerfil.status}).`)
    error.httpStatus = resPerfil.status
    throw error
  }
}

function escaparLiteralSql(valor) {
  return valor.replaceAll("'", "''")
}

function imprimirSqlManual(userId, entrada) {
  const uid = validarUuid(userId)
  const rol = entrada.rol
  if (!ROLES_VALIDOS.has(rol)) {
    throw new Error('Rol inválido al generar el bloque SQL manual.')
  }
  const nombreEscapado = escaparLiteralSql(entrada.nombre)

  console.error(
    '\n⚠️  El usuario quedó registrado en Auth, pero NO se pudieron sincronizar `public.usuario_roles` ni `public.perfiles`.',
  )
  console.error(`   userId: ${uid}`)
  console.error('   Ejecuta este bloque SQL en el contenedor Postgres del VPS y vuelve a verificar:\n')
  console.error(`docker exec -i <contenedor-postgres> psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.usuario_roles (user_id, rol)
VALUES ('${uid}'::uuid, '${rol}')
ON CONFLICT (user_id) DO UPDATE
  SET rol = EXCLUDED.rol,
      actualizado_en = now();

INSERT INTO public.perfiles (user_id, nombre)
VALUES ('${uid}'::uuid, '${nombreEscapado}')
ON CONFLICT (user_id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      actualizado_en = now();
COMMIT;
SQL\n`)
}

async function sincronizarTablasIam(urlBase, serviceRoleKey, databaseUrlDirect, userId, entrada) {
  const tienePsqlYUrl = Boolean(databaseUrlDirect) && psqlDisponible()

  if (entrada.metodoBd === 'sql') {
    if (!databaseUrlDirect) {
      imprimirSqlManual(userId, entrada)
      throw new Error('Falta DATABASE_URL_DIRECT para usar --metodo-bd sql.')
    }
    if (!psqlDisponible()) {
      imprimirSqlManual(userId, entrada)
      throw new Error('El binario `psql` no está disponible en el sistema para usar --metodo-bd sql.')
    }
    sincronizarPorPsql(databaseUrlDirect, userId, entrada)
    return 'sql'
  }

  if (entrada.metodoBd === 'rest') {
    await sincronizarPorRest(urlBase, serviceRoleKey, userId, entrada)
    return 'rest'
  }

  // Modo `auto`: si DATABASE_URL_DIRECT y psql están disponibles, sincroniza directo por SQL.
  if (tienePsqlYUrl) {
    sincronizarPorPsql(databaseUrlDirect, userId, entrada)
    return 'sql'
  }

  try {
    await sincronizarPorRest(urlBase, serviceRoleKey, userId, entrada)
    return 'rest'
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'httpStatus' in error ? error.httpStatus : undefined
    if (ESTADOS_POSTGREST_AUSENTE.has(status)) {
      if (databaseUrlDirect && psqlDisponible()) {
        sincronizarPorPsql(databaseUrlDirect, userId, entrada)
        return 'sql'
      }
      imprimirSqlManual(userId, entrada)
      throw new Error(
        `PostgREST no está disponible (HTTP ${status}) y no hay DATABASE_URL_DIRECT + psql locales para sincronizar IAM.`,
      )
    }
    throw error
  }
}

async function principal() {
  const opciones = parsearArgumentos(process.argv.slice(2))
  if (opciones.ayuda) {
    imprimirAyuda()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  const databaseUrlDirect = process.env.DATABASE_URL_DIRECT?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  }

  const entrada = validarEntrada(opciones)
  const { userId, creado, contrasena } = await crearOActualizarUsuario(supabaseUrl, serviceRoleKey, entrada)
  const metodoBdUsado = await sincronizarTablasIam(supabaseUrl, serviceRoleKey, databaseUrlDirect, userId, entrada)

  let mfa = 'sin_cambios'
  if (contrasena) {
    await enrolarTotp({
      urlBase: supabaseUrl,
      apikey: anonKey || serviceRoleKey,
      correo: entrada.correo,
      contrasena,
      mostrar: (texto) => process.stdout.write(`${texto}\n`),
      pedirCodigo: (intento) => leerLinea(`Primer código de 6 dígitos de la app (intento ${intento}/${INTENTOS_CODIGO}): `),
    })
    mfa = 'totp_verificado'
  }

  console.log(
    JSON.stringify(
      {
        estado: creado ? 'usuario_creado' : 'usuario_actualizado',
        userId,
        correo: entrada.correo,
        nombre: entrada.nombre,
        rol: entrada.rol,
        mfa,
        metodoBd: metodoBdUsado,
        siguientePaso:
          mfa === 'totp_verificado'
            ? 'La persona ya puede entrar en /acceso con su correo, su contraseña y el código de su app.'
            : 'Rol y nombre actualizados. Su TOTP no cambió.',
      },
      null,
      2,
    ),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Error inesperado al dar de alta el usuario.')
    process.exit(1)
  })
}
