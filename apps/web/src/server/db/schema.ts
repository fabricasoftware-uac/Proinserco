import { isNotNull, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

const authSchema = pgSchema('auth')

const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PA', 'PPT', 'NIT'] as const
const FINALIDADES_CONSENTIMIENTO = ['gestion_donacion', 'certificado_donacion', 'boletin'] as const
const ESTADOS_DONACION = ['creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo'] as const
const LINEAS_APOYO = ['donde-mas-se-necesite', 'educacion', 'salud', 'agricola'] as const
const ORIGENES_TRANSICION = ['servidor', 'conciliacion', 'webhook', 'panel'] as const
const ACCIONES_AUDITORIA = [
  'sesion.iniciada',
  'sesion.fallida',
  'sesion.mfa_fallido',
  'sesion.cerrada',
  'donacion.creada',
  'donacion.transicion',
  'donacion.discrepancia',
  'donacion.consultada',
  'donaciones.exportadas',
  'donante.registrado',
  'donante.dato_revelado',
  'donantes.exportados',
  'consentimiento.registrado',
  'ajustes.cambiados',
] as const
const ROLES_PANEL = ['administrador', 'consulta'] as const

export type DetallesAuditoriaDb = Record<string, string | number | boolean | null>

export const donantes = pgTable(
  'donantes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    tipoDocumento: text('tipo_documento', { enum: TIPOS_DOCUMENTO }).notNull(),
    numeroDocumento: text('numero_documento').notNull(),
    correo: text('correo').notNull(),
    celular: text('celular').notNull(),
    quiereCertificado: boolean('quiere_certificado').notNull().default(false),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('donantes_documento_uq').on(t.tipoDocumento, t.numeroDocumento),
    index('donantes_correo_idx').on(t.correo),
    index('donantes_creado_en_id_desc_idx').on(t.creadoEn.desc(), t.id.desc()),
    index('donantes_correo_trgm_idx').using('gin', sql`${t.correo} extensions.gin_trgm_ops`),
    index('donantes_busqueda_trgm_idx').using(
      'gin',
      sql`(${t.nombres} || ' ' || ${t.apellidos} || ' ' || ${t.correo}) extensions.gin_trgm_ops`,
    ),
    check('donantes_nombres_chk', sql`char_length(btrim(${t.nombres})) BETWEEN 2 AND 80 AND char_length(${t.nombres}) <= 80`),
    check(
      'donantes_apellidos_chk',
      sql`char_length(btrim(${t.apellidos})) BETWEEN 2 AND 80 AND char_length(${t.apellidos}) <= 80`,
    ),
    check('donantes_tipo_documento_chk', sql`${t.tipoDocumento} IN ('CC', 'CE', 'TI', 'PA', 'PPT', 'NIT')`),
    check('donantes_numero_documento_chk', sql`${t.numeroDocumento} ~ '^[0-9A-Za-z-]{4,20}$'`),
    check(
      'donantes_correo_chk',
      sql`char_length(${t.correo}) BETWEEN 3 AND 254 AND ${t.correo} = lower(btrim(${t.correo})) AND ${t.correo} ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
    check('donantes_celular_chk', sql`${t.celular} ~ '^\\+573[0-9]{9}$'`),
  ],
).enableRLS()

export const consentimientos = pgTable(
  'consentimientos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donanteId: uuid('donante_id')
      .notNull()
      .references(() => donantes.id, { onDelete: 'restrict' }),
    correo: text('correo').notNull(),
    finalidad: text('finalidad', { enum: FINALIDADES_CONSENTIMIENTO }).notNull(),
    versionTexto: text('version_texto').notNull(),
    otorgada: boolean('otorgada').notNull(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('consentimientos_donante_creado_idx').on(t.donanteId, t.creadoEn.desc(), t.id.desc()),
    check(
      'consentimientos_correo_chk',
      sql`char_length(${t.correo}) BETWEEN 3 AND 254 AND ${t.correo} = lower(btrim(${t.correo})) AND ${t.correo} ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
    check('consentimientos_finalidad_chk', sql`${t.finalidad} IN ('gestion_donacion', 'certificado_donacion', 'boletin')`),
    check('consentimientos_version_texto_chk', sql`char_length(btrim(${t.versionTexto})) BETWEEN 1 AND 120`),
    check('consentimientos_user_agent_chk', sql`${t.userAgent} IS NULL OR char_length(${t.userAgent}) <= 300`),
  ],
).enableRLS()

export const donaciones = pgTable(
  'donaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referencia: text('referencia').notNull().unique('donaciones_referencia_uq'),
    claveIdempotencia: uuid('clave_idempotencia').notNull().unique('donaciones_clave_idempotencia_uq'),
    estado: text('estado', { enum: ESTADOS_DONACION }).notNull().default('creada'),
    importeCentavos: bigint('importe_centavos', { mode: 'bigint' }).notNull(),
    moneda: char('moneda', { length: 3 }).$type<'COP'>().notNull().default('COP'),
    linea: text('linea', { enum: LINEAS_APOYO }).notNull().default('donde-mas-se-necesite'),
    donanteId: uuid('donante_id')
      .notNull()
      .references(() => donantes.id, { onDelete: 'restrict' }),
    pagadorNombres: text('pagador_nombres').notNull(),
    pagadorApellidos: text('pagador_apellidos').notNull(),
    pagadorCorreo: text('pagador_correo').notNull(),
    quiereCertificado: boolean('quiere_certificado').notNull(),
    idCargo: text('id_cargo').unique('donaciones_id_cargo_uq'),
    urlPago: text('url_pago'),
    metodoPago: text('metodo_pago'),
    creadaEn: timestamp('creada_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    actualizadaEn: timestamp('actualizada_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('donaciones_creada_en_id_desc_idx').on(t.creadaEn.desc(), t.id.desc()),
    index('donaciones_estado_creada_en_idx').on(t.estado, t.creadaEn.desc()),
    index('donaciones_linea_creada_en_idx').on(t.linea, t.creadaEn.desc()),
    index('donaciones_donante_id_idx').on(t.donanteId),
    index('donaciones_pagador_correo_trgm_idx').using('gin', sql`(lower(${t.pagadorCorreo})) extensions.gin_trgm_ops`),
    index('donaciones_referencia_trgm_idx').using('gin', sql`${t.referencia} extensions.gin_trgm_ops`),
    check('donaciones_referencia_chk', sql`${t.referencia} ~ '^DON-[0-9A-HJKMNP-TV-Z]{21}$'`),
    check(
      'donaciones_estado_chk',
      sql`${t.estado} IN ('creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo')`,
    ),
    check('donaciones_importe_centavos_chk', sql`${t.importeCentavos} > 0`),
    check('donaciones_moneda_chk', sql`${t.moneda} = 'COP'`),
    check('donaciones_linea_chk', sql`${t.linea} IN ('donde-mas-se-necesite', 'educacion', 'salud', 'agricola')`),
    check(
      'donaciones_pagador_nombres_chk',
      sql`char_length(btrim(${t.pagadorNombres})) BETWEEN 2 AND 80 AND char_length(${t.pagadorNombres}) <= 80`,
    ),
    check(
      'donaciones_pagador_apellidos_chk',
      sql`char_length(btrim(${t.pagadorApellidos})) BETWEEN 2 AND 80 AND char_length(${t.pagadorApellidos}) <= 80`,
    ),
    check(
      'donaciones_pagador_correo_chk',
      sql`char_length(${t.pagadorCorreo}) BETWEEN 3 AND 254 AND ${t.pagadorCorreo} = lower(btrim(${t.pagadorCorreo})) AND ${t.pagadorCorreo} ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
    check('donaciones_id_cargo_chk', sql`${t.idCargo} IS NULL OR char_length(btrim(${t.idCargo})) BETWEEN 1 AND 120`),
    check(
      'donaciones_url_pago_chk',
      sql`${t.urlPago} IS NULL OR (char_length(${t.urlPago}) <= 2048 AND ${t.urlPago} ~ '^https?://')`,
    ),
    check('donaciones_metodo_pago_chk', sql`${t.metodoPago} IS NULL OR char_length(btrim(${t.metodoPago})) BETWEEN 1 AND 60`),
  ],
).enableRLS()

export const donacionesTransiciones = pgTable(
  'donaciones_transiciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donacionId: uuid('donacion_id')
      .notNull()
      .references(() => donaciones.id, { onDelete: 'restrict' }),
    desde: text('desde', { enum: ESTADOS_DONACION }).notNull(),
    hacia: text('hacia', { enum: ESTADOS_DONACION }).notNull(),
    en: timestamp('en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    origen: text('origen', { enum: ORIGENES_TRANSICION }).notNull(),
  },
  (t) => [
    index('donaciones_transiciones_donacion_en_idx').on(t.donacionId, t.en.asc(), t.id.asc()),
    check(
      'donaciones_transiciones_desde_chk',
      sql`${t.desde} IN ('creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo')`,
    ),
    check(
      'donaciones_transiciones_hacia_chk',
      sql`${t.hacia} IN ('creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo')`,
    ),
    check('donaciones_transiciones_origen_chk', sql`${t.origen} IN ('servidor', 'conciliacion', 'webhook', 'panel')`),
    check(
      'donaciones_transiciones_valida_chk',
      sql`(${t.desde} = 'creada' AND ${t.hacia} IN ('pendiente', 'expirada')) OR (${t.desde} = 'pendiente' AND ${t.hacia} IN ('aprobada', 'rechazada', 'expirada')) OR (${t.desde} = 'aprobada' AND ${t.hacia} IN ('reembolsada', 'contracargo'))`,
    ),
  ],
).enableRLS()

export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ocurridoEn: timestamp('ocurrido_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    accion: text('accion', { enum: ACCIONES_AUDITORIA }).notNull(),
    actorId: text('actor_id').notNull(),
    recurso: text('recurso').notNull(),
    recursoId: text('recurso_id'),
    ip: inet('ip'),
    detalles: jsonb('detalles').$type<DetallesAuditoriaDb>().notNull().default({}),
  },
  (t) => [
    index('auditoria_ocurrido_en_id_desc_idx').on(t.ocurridoEn.desc(), t.id.desc()),
    index('auditoria_recurso_idx').on(t.recurso, t.recursoId, t.ocurridoEn.desc(), t.id.desc()),
    index('auditoria_accion_ocurrido_idx').on(t.accion, t.ocurridoEn.desc(), t.id.desc()),
    index('auditoria_actor_ocurrido_idx').on(t.actorId, t.ocurridoEn.desc(), t.id.desc()),
    check(
      'auditoria_accion_chk',
      sql`${t.accion} IN ('sesion.iniciada', 'sesion.fallida', 'sesion.mfa_fallido', 'sesion.cerrada', 'donacion.creada', 'donacion.transicion', 'donacion.discrepancia', 'donacion.consultada', 'donaciones.exportadas', 'donante.registrado', 'donante.dato_revelado', 'donantes.exportados', 'consentimiento.registrado', 'ajustes.cambiados')`,
    ),
    check('auditoria_actor_id_chk', sql`char_length(btrim(${t.actorId})) BETWEEN 1 AND 80`),
    check('auditoria_recurso_chk', sql`char_length(btrim(${t.recurso})) BETWEEN 1 AND 60`),
    check('auditoria_recurso_id_chk', sql`${t.recursoId} IS NULL OR char_length(${t.recursoId}) <= 120`),
    check('auditoria_detalles_chk', sql`jsonb_typeof(${t.detalles}) = 'object'`),
  ],
).enableRLS()

export const idempotenciaWebhooks = pgTable(
  'idempotencia_webhooks',
  {
    clave: text('clave').primaryKey(),
    resultado: text('resultado'),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('idempotencia_webhooks_creado_en_idx').on(t.creadoEn.desc()),
    check('idempotencia_webhooks_clave_chk', sql`char_length(btrim(${t.clave})) BETWEEN 1 AND 200`),
    check('idempotencia_webhooks_resultado_chk', sql`${t.resultado} IS NULL OR char_length(${t.resultado}) <= 120`),
  ],
).enableRLS()

export const bloqueosAcceso = pgTable(
  'bloqueos_acceso',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identificadorHash: text('identificador_hash').notNull().unique('bloqueos_acceso_identificador_uq'),
    fallosConsecutivos: integer('fallos_consecutivos').notNull().default(0),
    primerFalloEn: timestamp('primer_fallo_en', { withTimezone: true, mode: 'date' }),
    ultimoFalloEn: timestamp('ultimo_fallo_en', { withTimezone: true, mode: 'date' }),
    bloqueadoHasta: timestamp('bloqueado_hasta', { withTimezone: true, mode: 'date' }),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('bloqueos_acceso_bloqueado_hasta_idx').on(t.bloqueadoHasta).where(isNotNull(t.bloqueadoHasta)),
    check('bloqueos_acceso_identificador_chk', sql`char_length(btrim(${t.identificadorHash})) BETWEEN 16 AND 128`),
    check('bloqueos_acceso_fallos_chk', sql`${t.fallosConsecutivos} >= 0`),
  ],
).enableRLS()

export const usuarioRoles = pgTable(
  'usuario_roles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    rol: text('rol', { enum: ROLES_PANEL }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [check('usuario_roles_rol_chk', sql`${t.rol} IN ('administrador', 'consulta')`)],
).enableRLS()

export const perfiles = pgTable(
  'perfiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [check('perfiles_nombre_chk', sql`char_length(btrim(${t.nombre})) BETWEEN 2 AND 120`)],
).enableRLS()

export type FilaDonante = typeof donantes.$inferSelect
export type NuevaFilaDonante = typeof donantes.$inferInsert

export type FilaConsentimiento = typeof consentimientos.$inferSelect
export type NuevaFilaConsentimiento = typeof consentimientos.$inferInsert

export type FilaDonacion = typeof donaciones.$inferSelect
export type NuevaFilaDonacion = typeof donaciones.$inferInsert

export type FilaDonacionTransicion = typeof donacionesTransiciones.$inferSelect
export type NuevaFilaDonacionTransicion = typeof donacionesTransiciones.$inferInsert

export type FilaAuditoria = typeof auditoria.$inferSelect
export type NuevaFilaAuditoria = typeof auditoria.$inferInsert

export type FilaIdempotenciaWebhook = typeof idempotenciaWebhooks.$inferSelect
export type NuevaFilaIdempotenciaWebhook = typeof idempotenciaWebhooks.$inferInsert

export type FilaBloqueoAcceso = typeof bloqueosAcceso.$inferSelect
export type NuevaFilaBloqueoAcceso = typeof bloqueosAcceso.$inferInsert

export type FilaUsuarioRol = typeof usuarioRoles.$inferSelect
export type NuevaFilaUsuarioRol = typeof usuarioRoles.$inferInsert

export type FilaPerfil = typeof perfiles.$inferSelect
export type NuevaFilaPerfil = typeof perfiles.$inferInsert
