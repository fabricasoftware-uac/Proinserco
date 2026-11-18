#!/usr/bin/env node
// Alta administrativa de usuarios del panel de Proinserco (Node puro, sin dependencias).
//
// Uso recomendado:
//   1. Invitación por correo (el usuario fija su contraseña de >= 12 caracteres y enrola TOTP):
//      node --env-file=apps/web/.env.local scripts/alta-usuario-panel.mjs \
//        --correo persona@proinserco.org --nombre "Nombre Apellido" --rol consulta
//
//   2. Alta directa con contraseña (para entornos locales/staging sin SMTP configurado;
//      lee la contraseña por prompt oculto en TTY o mediante ALTA_USUARIO_CONTRASENA):
//      node --env-file=apps/web/.env.local scripts/alta-usuario-panel.mjs \
//        --correo admin@proinserco.org --nombre "Nombre Admin" --rol administrador --modo contrasena
//
//   3. En VPS sin PostgREST (`rest` desactivado), definir DATABASE_URL_DIRECT y usar `psql`
//      (en modo `auto` se detecta automáticamente o se fuerza con `--metodo-bd sql`).
//
// Seguridad:
//   - Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (NUNCA en el navegador ni en logs).
//   - Registra el rol en `public.usuario_roles` (fuente de verdad del hook JWT) y el
//     nombre visible en `public.perfiles`.
//   - Al primer ingreso al panel es obligatorio enrolar un factor MFA TOTP (aal2).

import { execFileSync, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const ROLES_VALIDOS = new Set(['administrador', 'consulta'])
const MODOS_VALIDOS = new Set(['invitacion', 'contrasena'])
const METODOS_BD_VALIDOS = new Set(['auto', 'sql', 'rest'])
const ESTADOS_POSTGREST_AUSENTE = new Set([404, 502, 503])
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTROL_CHARS_REGEX = /[\p{Cc}]/u

function imprimirAyuda() {
  console.log(`Uso:
  node --env-file=apps/web/.env.local scripts/alta-usuario-panel.mjs [opciones]

Opciones obligatorias:
  --correo <email>          Correo del usuario (se normaliza a minúsculas)
  --nombre <texto>          Nombre visible en el panel (2 a 120 caracteres)
  --rol <rol>               Rol en el panel: administrador | consulta

Opciones adicionales:
  --modo <modo>             invitacion (por defecto) | contrasena
  --metodo-bd <metodo>      auto (por defecto) | sql | rest
                              - auto: usa psql si DATABASE_URL_DIRECT y psql existen; si no,
                                intenta PostgREST (/rest/v1) y cae a psql o imprime el SQL si
                                PostgREST responde 404/502/503.
                              - sql:  sincroniza directo con psql usando DATABASE_URL_DIRECT.
                              - rest: sincroniza vía PostgREST (/rest/v1).
  --actualizar-existente    Si el correo ya existe en Auth, actualiza su rol y perfil
  -h, --ayuda               Muestra esta ayuda

Variables de entorno:
  SUPABASE_URL              Obligatoria. URL del proyecto Supabase (ej. http://127.0.0.1:54321)
  SUPABASE_SERVICE_ROLE_KEY Obligatoria. Clave de servicio de Supabase (NUNCA exponer en cliente)
  DATABASE_URL_DIRECT       Opcional (obligatoria con --metodo-bd sql o cuando PostgREST está desactivado)
  ALTA_USUARIO_CONTRASENA   Opcional con --modo contrasena (mínimo 12 caracteres; si falta, se pide por TTY)`)
}

function parsearArgumentos(argv) {
  const opciones = {
    correo: '',
    nombre: '',
    rol: '',
    modo: 'invitacion',
    metodoBd: 'auto',
    actualizarExistente: false,
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
    else if (clave === '--modo') opciones.modo = valor
    else if (clave === '--metodo-bd') opciones.metodoBd = valor
    else throw new Error(`Opción desconocida: ${clave}`)
  }

  return opciones
}

function validarEntrada(opciones) {
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

  if (!MODOS_VALIDOS.has(opciones.modo)) {
    throw new Error('El --modo debe ser "invitacion" o "contrasena".')
  }

  if (!METODOS_BD_VALIDOS.has(opciones.metodoBd)) {
    throw new Error('El --metodo-bd debe ser "auto", "sql" o "rest".')
  }

  return {
    correo,
    nombre,
    rol: opciones.rol,
    modo: opciones.modo,
    metodoBd: opciones.metodoBd,
    actualizarExistente: opciones.actualizarExistente,
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
    const rl = createInterface({ input: process.stdin })
    const linea = await rl.question('')
    rl.close()
    if (linea.length < 12 || linea.length > 256) {
      throw new Error('La contraseña debe tener entre 12 y 256 caracteres.')
    }
    return linea
  }

  process.stdout.write('Contraseña (>= 12 caracteres, entrada oculta): ')
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

async function peticionSupabase(url, serviceRoleKey, opciones = {}) {
  const respuesta = await fetch(url, {
    method: opciones.method ?? 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
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

async function crearOInvitarUsuario(urlBase, serviceRoleKey, entrada) {
  let respuesta
  if (entrada.modo === 'invitacion') {
    respuesta = await peticionSupabase(`${urlBase}/auth/v1/invite`, serviceRoleKey, {
      method: 'POST',
      body: { email: entrada.correo, data: { nombre: entrada.nombre } },
    })
  } else {
    const contrasena = await leerContrasenaOculta()
    respuesta = await peticionSupabase(`${urlBase}/auth/v1/admin/users`, serviceRoleKey, {
      method: 'POST',
      body: {
        email: entrada.correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre: entrada.nombre },
        app_metadata: { rol: entrada.rol },
      },
    })
  }

  if (respuesta.ok && respuesta.datos?.id) {
    const userId = validarUuid(respuesta.datos.id)
    if (entrada.modo === 'invitacion') {
      const actualizacion = await peticionSupabase(`${urlBase}/auth/v1/admin/users/${userId}`, serviceRoleKey, {
        method: 'PUT',
        body: { app_metadata: { rol: entrada.rol }, user_metadata: { nombre: entrada.nombre } },
      })
      if (!actualizacion.ok) {
        throw new Error(`Usuario invitado (${userId}), pero falló la actualización de metadatos (HTTP ${actualizacion.status}).`)
      }
    }
    return { userId, creado: true }
  }

  if (respuesta.status === 422 && entrada.actualizarExistente) {
    const existente = await buscarUsuarioPorCorreo(urlBase, serviceRoleKey, entrada.correo)
    if (!existente?.id) {
      throw new Error(`Auth respondió 422 para ${entrada.correo}, pero no se encontró el usuario al listarlo.`)
    }
    const userId = validarUuid(existente.id)
    const actualizacion = await peticionSupabase(`${urlBase}/auth/v1/admin/users/${userId}`, serviceRoleKey, {
      method: 'PUT',
      body: { app_metadata: { rol: entrada.rol }, user_metadata: { nombre: entrada.nombre } },
    })
    if (!actualizacion.ok) {
      throw new Error(`No se pudo actualizar el usuario existente en Auth (HTTP ${actualizacion.status}).`)
    }
    return { userId, creado: false }
  }

  const detalle = respuesta.datos?.msg || respuesta.datos?.message || `HTTP ${respuesta.status}`
  throw new Error(`Error al registrar usuario en Supabase Auth: ${detalle}`)
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
  const databaseUrlDirect = process.env.DATABASE_URL_DIRECT?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  }

  const entrada = validarEntrada(opciones)
  const { userId, creado } = await crearOInvitarUsuario(supabaseUrl, serviceRoleKey, entrada)
  const metodoBdUsado = await sincronizarTablasIam(supabaseUrl, serviceRoleKey, databaseUrlDirect, userId, entrada)

  console.log(
    JSON.stringify(
      {
        estado: creado ? 'usuario_creado' : 'usuario_actualizado',
        userId,
        correo: entrada.correo,
        nombre: entrada.nombre,
        rol: entrada.rol,
        modo: entrada.modo,
        metodoBd: metodoBdUsado,
        siguientePaso: 'El usuario debe iniciar sesión y enrolar obligatoriamente un factor MFA TOTP (aal2).',
      },
      null,
      2,
    ),
  )
}

principal().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Error inesperado al dar de alta el usuario.')
  process.exit(1)
})
