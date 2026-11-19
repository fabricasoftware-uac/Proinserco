import { randomBytes, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import postgres, { type Sql } from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearRegistroAuditoriaPostgres } from '@/modules/auditoria/infrastructure/registro-auditoria-postgres'
import { Donacion, type DonacionId } from '@/modules/donaciones/domain/donacion'
import { crearRepositorioDonacionesPostgres } from '@/modules/donaciones/infrastructure/repositorio-donaciones-postgres'
import type { DonanteId } from '@/modules/donantes/domain/donante'
import {
  crearRegistroConsentimientosPostgres,
  crearRepositorioDonantesPostgres,
} from '@/modules/donantes/infrastructure/repositorios-postgres'
import { PERMISOS_POR_ROL } from '@/modules/iam/domain/roles'
import { Actor } from '@/shared/domain/actor'
import { NoAutenticado } from '@/shared/domain/errores'
import { importeDesdePesos } from '@/shared/domain/importe'
import { cerrarDb } from './cliente'
import { conTransaccionDb, ejecutarConContextoDb } from './contexto-db'
import { donacionesTransiciones } from './schema'

const TABLAS_PUBLIC = [
  'donantes',
  'consentimientos',
  'donaciones',
  'donaciones_transiciones',
  'donaciones_consultas_pasarela',
  'auditoria',
  'idempotencia_webhooks',
  'bloqueos_acceso',
  'usuario_roles',
  'perfiles',
] as const

const TABLAS_INMUTABLES = ['auditoria', 'consentimientos', 'donaciones_transiciones'] as const

const ALFABETO_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function generarReferencia(): string {
  const bytes = randomBytes(21)
  let sufijo = ''
  for (const b of bytes) {
    sufijo += ALFABETO_CROCKFORD[b % 32] ?? '0'
  }
  return `DON-${sufijo}`
}

const ROLLBACK_PRUEBA = new Error('__ROLLBACK_PRUEBA__')

async function enTransaccionRevertida(cliente: Sql, fn: (tx: Sql) => Promise<void>): Promise<void> {
  try {
    await cliente.begin(async (tx) => {
      await fn(tx as unknown as Sql)
      throw ROLLBACK_PRUEBA
    })
  } catch (error) {
    if (error !== ROLLBACK_PRUEBA) throw error
  }
}

async function esperarRechazoPrivilegio(tx: Sql, ejecutar: () => Promise<unknown>): Promise<void> {
  await tx.unsafe('SAVEPOINT sp_rls')
  let errorCapturado: unknown
  let completoSinError = false
  try {
    await ejecutar()
    completoSinError = true
  } catch (error) {
    errorCapturado = error
    await tx.unsafe('ROLLBACK TO SAVEPOINT sp_rls')
  } finally {
    if (completoSinError) {
      await tx.unsafe('ROLLBACK TO SAVEPOINT sp_rls')
    }
    await tx.unsafe('RELEASE SAVEPOINT sp_rls')
  }
  expect(completoSinError).toBe(false)
  const codigo =
    typeof errorCapturado === 'object' && errorCapturado !== null && 'code' in errorCapturado
      ? (errorCapturado as { code?: string }).code
      : undefined
  expect(codigo).toBe('42501')
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL

describe.runIf(Boolean(testDatabaseUrl))('Seguridad RLS, inmutabilidad y concurrencia en PostgreSQL', () => {
  const envPrevio = {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_URL: process.env.APP_URL,
    SESION_SECRETO: process.env.SESION_SECRETO,
  }

  const adminId = '11111111-1111-4111-8111-111111111111'
  const consultaId = '22222222-2222-4222-8222-222222222222'

  const actorAdminAal2 = new Actor(
    adminId,
    'Admin RLS',
    'admin-rls@proinserco.test',
    'administrador',
    PERMISOS_POR_ROL.administrador,
    'aal2',
  )
  const actorAal1 = new Actor(
    adminId,
    'Admin AAL1',
    'admin-rls@proinserco.test',
    'administrador',
    PERMISOS_POR_ROL.administrador,
    'aal1',
  )

  let sqlCliente: Sql
  let donanteIdSemilla: DonanteId
  let donacionIdSemilla: DonacionId
  let consentimientoIdSemilla: string
  let auditoriaIdSemilla: string
  let puedeAsumirAnon = false
  let puedeAsumirServiceRole = false
  let puedeInsertarAuthUsers = false
  let esDuenoAuditoriaOSuper = false

  beforeAll(async () => {
    if (!testDatabaseUrl) return
    process.env.DATABASE_URL = testDatabaseUrl
    process.env.APP_URL ??= 'http://localhost:3000'
    process.env.SESION_SECRETO ??= 'secreto-pruebas-rls-minimo-32-caracteres-123'

    sqlCliente = postgres(testDatabaseUrl, { prepare: false, max: 5 })

    const [capacidades] = await sqlCliente<
      Array<{
        puede_anon: boolean
        puede_service_role: boolean
        es_dueno_o_super: boolean
        puede_auth_users: boolean
      }>
    >`
      SELECT
        (r.rolsuper OR pg_has_role(current_user, 'anon', 'MEMBER')) AS puede_anon,
        (r.rolsuper OR pg_has_role(current_user, 'service_role', 'MEMBER')) AS puede_service_role,
        (
          r.rolsuper
          OR EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'auditoria'
              AND pg_has_role(current_user, c.relowner, 'MEMBER')
          )
        ) AS es_dueno_o_super,
        has_table_privilege(current_user, 'auth.users', 'INSERT') AS puede_auth_users
      FROM pg_roles r
      WHERE r.rolname = current_user
    `
    puedeAsumirAnon = Boolean(capacidades?.puede_anon)
    puedeAsumirServiceRole = Boolean(capacidades?.puede_service_role)
    esDuenoAuditoriaOSuper = Boolean(capacidades?.es_dueno_o_super)
    puedeInsertarAuthUsers = Boolean(capacidades?.puede_auth_users)

    const repoDonantes = crearRepositorioDonantesPostgres()
    const repoConsentimientos = crearRegistroConsentimientosPostgres()
    const repoDonaciones = crearRepositorioDonacionesPostgres()
    const repoAuditoria = crearRegistroAuditoriaPostgres()

    const sufijo = randomUUID().replaceAll('-', '').slice(0, 12)
    donanteIdSemilla = randomUUID() as DonanteId
    donacionIdSemilla = randomUUID() as DonacionId
    consentimientoIdSemilla = randomUUID()
    auditoriaIdSemilla = randomUUID()
    const ahora = new Date('2026-11-16T15:00:00.000Z')

    await repoDonantes.registrarSiNoExiste({
      id: donanteIdSemilla,
      nombres: 'Donante RLS',
      apellidos: 'Semilla Test',
      tipoDocumento: 'CC',
      numeroDocumento: `8${sufijo}`,
      correo: `rls.${sufijo}@proinserco.test`,
      celular: '+573001234567',
      quiereCertificado: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })

    await repoConsentimientos.insertar({
      id: consentimientoIdSemilla,
      donanteId: donanteIdSemilla,
      correo: `rls.${sufijo}@proinserco.test`,
      finalidad: 'gestion_donacion',
      versionTexto: 'v-rls-test',
      otorgada: true,
      ip: '192.0.2.10',
      userAgent: 'vitest-rls',
      creadoEn: ahora,
    })

    const creada = Donacion.crear(
      {
        id: donacionIdSemilla,
        referencia: generarReferencia(),
        claveIdempotencia: randomUUID(),
        importe: importeDesdePesos(50_000),
        linea: 'educacion',
        donanteId: donanteIdSemilla,
        pagador: {
          nombres: 'Donante RLS',
          apellidos: 'Semilla Test',
          correo: `rls.${sufijo}@proinserco.test`,
        },
        quiereCertificado: true,
      },
      ahora,
    )
    await repoDonaciones.insertar(creada)
    const pendiente = creada.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/rls', ahora)
    expect(await repoDonaciones.actualizarSiEstado(pendiente, 'creada')).toBe(true)

    await repoAuditoria.insertar({
      id: auditoriaIdSemilla,
      ocurridoEn: ahora,
      accion: 'donacion.creada',
      actorId: 'sistema',
      recurso: 'donacion',
      recursoId: donacionIdSemilla,
      ip: '192.0.2.10',
      detalles: { origen: 'rls-test' },
    })
  })

  afterAll(async () => {
    await cerrarDb()
    if (sqlCliente) await sqlCliente.end({ timeout: 5 })
    process.env.DATABASE_URL = envPrevio.DATABASE_URL
    process.env.APP_URL = envPrevio.APP_URL
    process.env.SESION_SECRETO = envPrevio.SESION_SECRETO
  })

  it('anon y authenticated tienen cero privilegios sobre public/private y todas las tablas tienen RLS ENABLE + FORCE', async () => {
    const [esquemas] = await sqlCliente<
      Array<{
        anon_public: boolean
        auth_public: boolean
        anon_private: boolean
        auth_private: boolean
      }>
    >`
      SELECT
        has_schema_privilege('anon', 'public', 'USAGE') AS anon_public,
        has_schema_privilege('authenticated', 'public', 'USAGE') AS auth_public,
        has_schema_privilege('anon', 'private', 'USAGE') AS anon_private,
        has_schema_privilege('authenticated', 'private', 'USAGE') AS auth_private
    `
    expect(esquemas).toEqual({
      anon_public: false,
      auth_public: false,
      anon_private: false,
      auth_private: false,
    })

    const estadosRls = await sqlCliente<Array<{ tabla: string; habilitado: boolean; forzado: boolean }>>`
      SELECT c.relname AS tabla, c.relrowsecurity AS habilitado, c.relforcerowsecurity AS forzado
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `
    expect(estadosRls.map((r) => r.tabla).sort()).toEqual([...TABLAS_PUBLIC].sort())
    for (const fila of estadosRls) {
      expect(fila.habilitado).toBe(true)
      expect(fila.forzado).toBe(true)
    }

    for (const tabla of TABLAS_PUBLIC) {
      for (const rol of ['anon', 'authenticated'] as const) {
        for (const op of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const) {
          const [priv] = await sqlCliente<Array<{ permitido: boolean }>>`
            SELECT has_table_privilege(${rol}, ${`public.${tabla}`}, ${op}) AS permitido
          `
          expect(priv?.permitido).toBe(false)
        }
      }
    }

    if (puedeAsumirAnon) {
      for (const rol of ['anon', 'authenticated'] as const) {
        await enTransaccionRevertida(sqlCliente, async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE ${rol}`)
          for (const tabla of TABLAS_PUBLIC) {
            await esperarRechazoPrivilegio(tx, () => tx.unsafe(`SELECT 1 FROM public.${tabla} LIMIT 1`))
            await esperarRechazoPrivilegio(tx, () => tx.unsafe(`DELETE FROM public.${tabla}`))
          }
          await esperarRechazoPrivilegio(tx, () =>
            tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('sesion.iniciada', 'ataque', 'sesion')`),
          )
          await esperarRechazoPrivilegio(tx, () =>
            tx.unsafe(`UPDATE public.donaciones SET estado = 'aprobada' WHERE id = $1`, [donacionIdSemilla]),
          )
        })
      }
    }
  })

  it('aísla proinserco_publico, proinserco_sistema y proinserco_panel (aal1 denegado vs aal2 consulta vs administrador)', async () => {
    // 1. proinserco_publico
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_publico')

      // Sin privilegios de tabla sobre donantes, donaciones ni transiciones (migración 20261118200000).
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.donantes LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.donaciones LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.donaciones_transiciones LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT donacion_id FROM public.donaciones_consultas_pasarela LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.consentimientos LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.auditoria LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT clave FROM public.idempotencia_webhooks LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.bloqueos_acceso LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT user_id FROM public.usuario_roles LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT user_id FROM public.perfiles LIMIT 1'))

      // No puede insertar donación ya aprobada ni escalar estado a aprobada
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(
          `INSERT INTO public.donaciones (referencia, clave_idempotencia, estado, importe_centavos, donante_id, pagador_nombres, pagador_apellidos, pagador_correo, quiere_certificado)
           VALUES ($1, $2, 'aprobada', 5000000, $3, 'Ana', 'Test', 'ana@proinserco.test', true)`,
          [generarReferencia(), randomUUID(), donanteIdSemilla],
        ),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.donaciones SET estado = 'aprobada' WHERE id = $1`, [donacionIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('ajustes.cambiados', 'sistema', 'ajustes')`),
      )
    })

    // 2. proinserco_sistema
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_sistema')

      expect(await tx.unsafe('SELECT id FROM public.donaciones WHERE id = $1', [donacionIdSemilla])).toHaveLength(1)
      expect(await tx.unsafe('SELECT id FROM public.consentimientos WHERE id = $1', [consentimientoIdSemilla])).toHaveLength(1)

      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.auditoria LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT user_id FROM public.usuario_roles LIMIT 1'))
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(
          `INSERT INTO public.donaciones (referencia, clave_idempotencia, estado, importe_centavos, donante_id, pagador_nombres, pagador_apellidos, pagador_correo, quiere_certificado)
           VALUES ($1, $2, 'creada', 5000000, $3, 'Ana', 'Test', 'ana@proinserco.test', true)`,
          [generarReferencia(), randomUUID(), donanteIdSemilla],
        ),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('ajustes.cambiados', $1, 'ajustes')`, [
          adminId,
        ]),
      )
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('DELETE FROM public.donantes WHERE id = $1', [donanteIdSemilla]))
    })

    // 3. proinserco_panel con aal1 (rechazado tanto en conTransaccionDb como en RLS)
    await expect(
      ejecutarConContextoDb({ modo: 'panel', actor: actorAal1 }, () => conTransaccionDb(async () => 'bloqueado')),
    ).rejects.toThrow(NoAutenticado)

    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_panel')
      const claimsAal1 = JSON.stringify({ sub: adminId, aal: 'aal1', app_metadata: { rol: 'administrador' } })
      await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [claimsAal1])

      expect(await tx.unsafe('SELECT id FROM public.donantes')).toHaveLength(0)
      expect(await tx.unsafe('SELECT id FROM public.consentimientos')).toHaveLength(0)
      expect(await tx.unsafe('SELECT id FROM public.donaciones')).toHaveLength(0)
      expect(await tx.unsafe('SELECT id FROM public.donaciones_transiciones')).toHaveLength(0)
      expect(await tx.unsafe('SELECT id FROM public.auditoria')).toHaveLength(0)

      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('donacion.consultada', $1, 'donacion')`, [
          adminId,
        ]),
      )
    })

    // 4. proinserco_panel con aal2: consulta vs administrador
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_panel')
      const claimsConsulta = JSON.stringify({ sub: consultaId, aal: 'aal2', app_metadata: { rol: 'consulta' } })
      await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [claimsConsulta])

      expect(await tx.unsafe('SELECT id FROM public.donantes WHERE id = $1', [donanteIdSemilla])).toHaveLength(1)
      expect(await tx.unsafe('SELECT id FROM public.donaciones WHERE id = $1', [donacionIdSemilla])).toHaveLength(1)
      expect(await tx.unsafe('SELECT id FROM public.auditoria WHERE id = $1', [auditoriaIdSemilla])).toHaveLength(1)

      // consulta puede auditar donacion.consultada propia, pero NO ajustes.cambiados ni suplantar actor_id
      await tx.unsafe(
        `INSERT INTO public.auditoria (accion, actor_id, recurso, recurso_id) VALUES ('donacion.consultada', $1, 'donacion', $2)`,
        [consultaId, donacionIdSemilla],
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('ajustes.cambiados', $1, 'ajustes')`, [
          consultaId,
        ]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('donacion.consultada', $1, 'donacion')`, [
          adminId,
        ]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.donaciones SET estado = 'aprobada' WHERE id = $1`, [donacionIdSemilla]),
      )
    })

    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_panel')
      const claimsAdmin = JSON.stringify({ sub: adminId, aal: 'aal2', app_metadata: { rol: 'administrador' } })
      await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [claimsAdmin])

      await tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('ajustes.cambiados', $1, 'ajustes')`, [
        adminId,
      ])
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('ajustes.cambiados', $1, 'ajustes')`, [
          consultaId,
        ]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.donaciones SET estado = 'aprobada' WHERE id = $1`, [donacionIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id FROM public.bloqueos_acceso LIMIT 1'))
    })

    // 5. Aislamiento por fila en usuario_roles y perfiles cuando la conexión permite sembrar auth.users
    if (puedeInsertarAuthUsers) {
      await enTransaccionRevertida(sqlCliente, async (tx) => {
        const uAdmin = randomUUID()
        const uConsulta = randomUUID()

        await tx.unsafe(`INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)`, [
          uAdmin,
          `adm-${uAdmin}@proinserco.test`,
          uConsulta,
          `con-${uConsulta}@proinserco.test`,
        ])
        await tx.unsafe(`INSERT INTO public.usuario_roles (user_id, rol) VALUES ($1, 'administrador'), ($2, 'consulta')`, [
          uAdmin,
          uConsulta,
        ])
        await tx.unsafe(`INSERT INTO public.perfiles (user_id, nombre) VALUES ($1, 'Admin A'), ($2, 'Consulta B')`, [
          uAdmin,
          uConsulta,
        ])

        await tx.unsafe('SAVEPOINT sp_panel_roles')
        await tx.unsafe('SET LOCAL ROLE proinserco_panel')
        await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: uConsulta, aal: 'aal2', app_metadata: { rol: 'consulta' } }),
        ])
        const rolesConsulta = await tx.unsafe('SELECT user_id FROM public.usuario_roles WHERE user_id IN ($1, $2)', [
          uAdmin,
          uConsulta,
        ])
        const perfilesConsulta = await tx.unsafe('SELECT user_id FROM public.perfiles WHERE user_id IN ($1, $2)', [
          uAdmin,
          uConsulta,
        ])
        expect(rolesConsulta.map((r) => r.user_id)).toEqual([uConsulta])
        expect(perfilesConsulta.map((r) => r.user_id)).toEqual([uConsulta])

        await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: uAdmin, aal: 'aal2', app_metadata: { rol: 'administrador' } }),
        ])
        const rolesAdmin = await tx.unsafe('SELECT user_id FROM public.usuario_roles WHERE user_id IN ($1, $2)', [
          uAdmin,
          uConsulta,
        ])
        const perfilesAdmin = await tx.unsafe('SELECT user_id FROM public.perfiles WHERE user_id IN ($1, $2)', [
          uAdmin,
          uConsulta,
        ])
        expect(rolesAdmin.map((r) => r.user_id)).toEqual([uAdmin])
        expect(new Set(perfilesAdmin.map((r) => r.user_id))).toEqual(new Set([uAdmin, uConsulta]))
        await tx.unsafe('RELEASE SAVEPOINT sp_panel_roles')
      })
    }
  })

  it('auditoria, consentimientos y donaciones_transiciones son estrictamente inmutables (REVOKE + triggers)', async () => {
    const triggers = await sqlCliente<Array<{ tabla: string; trigger_nombre: string; habilitado: string }>>`
      SELECT c.relname AS tabla, t.tgname AS trigger_nombre, t.tgenabled AS habilitado
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
        AND c.relname IN ('auditoria', 'consentimientos', 'donaciones_transiciones')
      ORDER BY c.relname, t.tgname
    `
    const nombresTriggers = triggers.map((t) => t.trigger_nombre)
    expect(nombresTriggers).toContain('auditoria_sin_mutacion_fila')
    expect(nombresTriggers).toContain('auditoria_sin_truncate')
    expect(nombresTriggers).toContain('consentimientos_sin_mutacion_fila')
    expect(nombresTriggers).toContain('consentimientos_sin_truncate')
    expect(nombresTriggers).toContain('donaciones_transiciones_sin_mutacion_fila')
    expect(nombresTriggers).toContain('donaciones_transiciones_sin_truncate')
    for (const t of triggers) {
      expect(t.habilitado).not.toBe('D')
    }

    // Roles de aplicación (incluido proinserco_panel con aal2 y administrador)
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_panel')
      await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: adminId, aal: 'aal2', app_metadata: { rol: 'administrador' } }),
      ])

      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.auditoria SET recurso = 'tamper' WHERE id = $1`, [auditoriaIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () => tx.unsafe(`DELETE FROM public.auditoria WHERE id = $1`, [auditoriaIdSemilla]))
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.consentimientos SET otorgada = false WHERE id = $1`, [consentimientoIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`DELETE FROM public.consentimientos WHERE id = $1`, [consentimientoIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.donaciones_transiciones SET hacia = 'aprobada' WHERE donacion_id = $1`, [donacionIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`DELETE FROM public.donaciones_transiciones WHERE donacion_id = $1`, [donacionIdSemilla]),
      )
      for (const tabla of TABLAS_INMUTABLES) {
        await esperarRechazoPrivilegio(tx, () => tx.unsafe(`TRUNCATE TABLE public.${tabla}`))
      }
    })

    // service_role tampoco puede mutar ni truncar las tablas inmutables
    if (puedeAsumirServiceRole) {
      await enTransaccionRevertida(sqlCliente, async (tx) => {
        await tx.unsafe('SET LOCAL ROLE service_role')
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`UPDATE public.auditoria SET recurso = 'tamper' WHERE id = $1`, [auditoriaIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () => tx.unsafe(`DELETE FROM public.auditoria WHERE id = $1`, [auditoriaIdSemilla]))
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`UPDATE public.consentimientos SET otorgada = false WHERE id = $1`, [consentimientoIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`DELETE FROM public.consentimientos WHERE id = $1`, [consentimientoIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`UPDATE public.donaciones_transiciones SET hacia = 'aprobada' WHERE donacion_id = $1`, [donacionIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`DELETE FROM public.donaciones_transiciones WHERE donacion_id = $1`, [donacionIdSemilla]),
        )
        for (const tabla of TABLAS_INMUTABLES) {
          await esperarRechazoPrivilegio(tx, () => tx.unsafe(`TRUNCATE TABLE public.${tabla}`))
        }
      })
    }

    // Incluso con el rol dueño de las tablas o superusuario (triggers BEFORE UPDATE/DELETE/TRUNCATE)
    if (esDuenoAuditoriaOSuper) {
      await enTransaccionRevertida(sqlCliente, async (tx) => {
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`UPDATE public.auditoria SET recurso = 'tamper' WHERE id = $1`, [auditoriaIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () => tx.unsafe(`DELETE FROM public.auditoria WHERE id = $1`, [auditoriaIdSemilla]))
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`UPDATE public.consentimientos SET otorgada = false WHERE id = $1`, [consentimientoIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`DELETE FROM public.consentimientos WHERE id = $1`, [consentimientoIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`UPDATE public.donaciones_transiciones SET hacia = 'aprobada' WHERE donacion_id = $1`, [donacionIdSemilla]),
        )
        await esperarRechazoPrivilegio(tx, () =>
          tx.unsafe(`DELETE FROM public.donaciones_transiciones WHERE donacion_id = $1`, [donacionIdSemilla]),
        )
        for (const tabla of TABLAS_INMUTABLES) {
          await esperarRechazoPrivilegio(tx, () => tx.unsafe(`TRUNCATE TABLE public.${tabla}`))
        }
      })
    }
  })

  it('proinserco_publico ya no puede LISTAR ni MODIFICAR donantes/donaciones directamente', async () => {
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_publico')
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT id, correo, celular FROM public.donantes'))
      await esperarRechazoPrivilegio(tx, () => tx.unsafe('SELECT referencia, pagador_correo FROM public.donaciones'))
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.donantes SET correo = 'atacante@proinserco.test' WHERE id = $1`, [donanteIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () => tx.unsafe(`UPDATE public.donantes SET celular = '+573110000000'`))
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(
          `INSERT INTO public.donantes (nombres, apellidos, tipo_documento, numero_documento, correo, celular)
           VALUES ('Ana', 'Test', 'CC', '99999999', 'ana@proinserco.test', '+573001234567')`,
        ),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(
          `INSERT INTO public.donaciones (referencia, clave_idempotencia, estado, importe_centavos, donante_id, pagador_nombres, pagador_apellidos, pagador_correo, quiere_certificado)
           VALUES ($1, $2, 'creada', 5000000, $3, 'Ana', 'Test', 'ana@proinserco.test', true)`,
          [generarReferencia(), randomUUID(), donanteIdSemilla],
        ),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(`UPDATE public.donaciones SET url_pago = 'https://evil.test' WHERE id = $1`, [donacionIdSemilla]),
      )
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(
          `INSERT INTO public.donaciones_transiciones (donacion_id, desde, hacia, origen) VALUES ($1, 'creada', 'pendiente', 'servidor')`,
          [donacionIdSemilla],
        ),
      )
    })
  })

  it('las funciones del flujo público son SECURITY DEFINER acotadas: search_path fijo, sin EXECUTE para PUBLIC/anon y dueño sin BYPASSRLS', async () => {
    const funciones = await sqlCliente<
      Array<{
        nombre: string
        definer: boolean
        config: string[] | null
        dueno: string
        bypass: boolean
        publico: boolean
        anon: boolean
      }>
    >`
      SELECT p.proname AS nombre, p.prosecdef AS definer, p.proconfig AS config, r.rolname AS dueno, r.rolbypassrls AS bypass,
             has_function_privilege('proinserco_publico', p.oid, 'EXECUTE') AS publico,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_roles r ON r.oid = p.proowner
       WHERE n.nspname = 'public'
         AND p.proname IN ('registrar_donante_publico', 'crear_donacion_publica', 'registrar_cargo_donacion_publica',
                           'intento_donacion_por_clave', 'resultado_donacion_publica', 'reservar_consulta_pasarela_publica')
    `
    expect(funciones).toHaveLength(6)
    for (const f of funciones) {
      expect(f.definer).toBe(true)
      expect(f.config).toContain('search_path=""')
      expect(f.dueno).toBe('proinserco_flujo_publico')
      expect(f.bypass).toBe(false)
      expect(f.publico).toBe(true)
      expect(f.anon).toBe(false)
    }
    const [sistema] = await sqlCliente<Array<{ puede: boolean }>>`
      SELECT has_function_privilege('proinserco_sistema', 'public.registrar_donante_publico(uuid, text, text, text, text, text, text, boolean, timestamptz)', 'EXECUTE') AS puede
    `
    expect(sistema?.puede).toBe(false)
  })

  it('registrar_donante_publico con un documento existente no sobrescribe los datos de contacto de otra persona', async () => {
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      const [antes] = await tx.unsafe(
        'SELECT tipo_documento, numero_documento, nombres, correo, celular FROM public.donantes WHERE id = $1',
        [donanteIdSemilla],
      )
      await tx.unsafe('SET LOCAL ROLE proinserco_publico')
      const [resultado] = await tx.unsafe(
        `SELECT donante_id, existia FROM public.registrar_donante_publico($1, 'Suplantador', 'Malicioso', $2, $3, 'atacante@proinserco.test', '+573119999999', true, now())`,
        [randomUUID(), antes?.tipo_documento, antes?.numero_documento],
      )
      expect(resultado).toEqual({ donante_id: donanteIdSemilla, existia: true })
      await tx.unsafe('RESET ROLE')
      const [despues] = await tx.unsafe(
        'SELECT nombres, correo, celular, quiere_certificado FROM public.donantes WHERE id = $1',
        [donanteIdSemilla],
      )
      expect(despues).toEqual({
        nombres: antes?.nombres,
        correo: antes?.correo,
        celular: antes?.celular,
        quiere_certificado: true,
      })
    })
  })

  it('resultado_donacion_publica devuelve UNA donación sin datos personales y nada con referencias inválidas', async () => {
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      const [donacion] = await tx.unsafe('SELECT referencia FROM public.donaciones WHERE id = $1', [donacionIdSemilla])
      await tx.unsafe('SET LOCAL ROLE proinserco_publico')
      const filas = await tx.unsafe('SELECT * FROM public.resultado_donacion_publica($1)', [donacion?.referencia])
      expect(filas).toHaveLength(1)
      expect(Object.keys(filas[0] ?? {}).sort()).toEqual(
        ['creada_en', 'estado', 'importe_centavos', 'moneda', 'quiere_certificado', 'referencia'].sort(),
      )
      expect(await tx.unsafe(`SELECT * FROM public.resultado_donacion_publica('%')`)).toHaveLength(0)
      expect(await tx.unsafe(`SELECT * FROM public.resultado_donacion_publica($1)`, [`' OR '1'='1`])).toHaveLength(0)
    })
  })

  it('el rol de sistema puede auditar conciliacion.alerta; el público no', async () => {
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_sistema')
      await tx.unsafe(
        `INSERT INTO public.auditoria (accion, actor_id, recurso, detalles) VALUES ('conciliacion.alerta', 'sistema', 'conciliacion', '{"severidad":"critica"}')`,
      )
    })
    await enTransaccionRevertida(sqlCliente, async (tx) => {
      await tx.unsafe('SET LOCAL ROLE proinserco_publico')
      await esperarRechazoPrivilegio(tx, () =>
        tx.unsafe(
          `INSERT INTO public.auditoria (accion, actor_id, recurso) VALUES ('conciliacion.alerta', 'sistema', 'conciliacion')`,
        ),
      )
    })
  })

  it('concurrencia real en RepositorioDonacionesPostgres.actualizarSiEstado: solo 1 transición y 1 fila en donaciones_transiciones', async () => {
    const repo = crearRepositorioDonacionesPostgres()
    const t0 = new Date('2026-11-17T10:00:00.000Z')
    const t1 = new Date('2026-11-17T10:01:00.000Z')
    const t2 = new Date('2026-11-17T10:02:00.000Z')
    const t3 = new Date('2026-11-17T10:03:00.000Z')

    const donacion = Donacion.crear(
      {
        id: randomUUID() as DonacionId,
        referencia: generarReferencia(),
        claveIdempotencia: randomUUID(),
        importe: importeDesdePesos(90_000),
        linea: 'salud',
        donanteId: donanteIdSemilla,
        pagador: { nombres: 'Carrera', apellidos: 'Concurrente', correo: 'carrera@proinserco.test' },
        quiereCertificado: false,
      },
      t0,
    )
    await repo.insertar(donacion)

    const pendiente = donacion.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/carrera', t1)
    expect(await repo.actualizarSiEstado(pendiente, 'creada')).toBe(true)

    const opcionAprobada = pendiente.transicionar('aprobada', t2, 'webhook', { metodoPago: 'card' })
    const opcionRechazada = pendiente.transicionar('rechazada', t3, 'conciliacion')

    const [ganoAprobada, ganoRechazada] = await Promise.all([
      repo.actualizarSiEstado(opcionAprobada, 'pendiente'),
      repo.actualizarSiEstado(opcionRechazada, 'pendiente'),
    ])

    expect([ganoAprobada, ganoRechazada].filter(Boolean)).toHaveLength(1)
    expect(ganoAprobada).not.toBe(ganoRechazada)

    const persistida = await repo.buscarPorId(donacion.id)
    expect(persistida?.estado).toBe(ganoAprobada ? 'aprobada' : 'rechazada')
    expect(persistida?.datos.historial).toHaveLength(2)

    const filasTransiciones = await ejecutarConContextoDb({ modo: 'panel', actor: actorAdminAal2 }, () =>
      conTransaccionDb((tx) =>
        tx.select().from(donacionesTransiciones).where(eq(donacionesTransiciones.donacionId, donacion.id)),
      ),
    )

    expect(filasTransiciones).toHaveLength(2)
    expect(filasTransiciones.filter((f) => f.desde === 'pendiente')).toHaveLength(1)
    expect(filasTransiciones.find((f) => f.desde === 'pendiente')?.hacia).toBe(ganoAprobada ? 'aprobada' : 'rechazada')
  })
})
