import { afterAll, beforeAll, describe } from 'vitest'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import { crearRegistroAuditoriaPostgres } from '@/modules/auditoria/infrastructure/registro-auditoria-postgres'
import { PERMISOS_POR_ROL } from '@/modules/iam/domain/roles'
import { cerrarDb } from '@/server/db/cliente'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { Actor } from '@/shared/domain/actor'
import { probarContratoRegistroAuditoria } from '@/test/contratos/registro-auditoria.contrato'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'

describe('RegistroAuditoria en Memoria — contrato', () => {
  probarContratoRegistroAuditoria(() => ({
    registro: crearRegistroAuditoriaMemoria(),
    actorPanelId: ADMIN_ID,
    enContextoPanel: (fn) => fn(),
  }))
})

const testDatabaseUrl = process.env.TEST_DATABASE_URL

describe.runIf(Boolean(testDatabaseUrl))('RegistroAuditoria en PostgreSQL — contrato', () => {
  const envPrevio = {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_URL: process.env.APP_URL,
    SESION_SECRETO: process.env.SESION_SECRETO,
  }

  const adminActor = new Actor(
    ADMIN_ID,
    'Admin Contrato',
    'admin-contrato@proinserco.test',
    'administrador',
    PERMISOS_POR_ROL.administrador,
    'aal2',
  )

  beforeAll(() => {
    if (!testDatabaseUrl) return
    process.env.DATABASE_URL = testDatabaseUrl
    process.env.APP_URL ??= 'http://localhost:3000'
    process.env.SESION_SECRETO ??= 'secreto-pruebas-contrato-minimo-32-caracteres'
  })

  afterAll(async () => {
    await cerrarDb()
    process.env.DATABASE_URL = envPrevio.DATABASE_URL
    process.env.APP_URL = envPrevio.APP_URL
    process.env.SESION_SECRETO = envPrevio.SESION_SECRETO
  })

  probarContratoRegistroAuditoria(() => ({
    registro: crearRegistroAuditoriaPostgres(),
    actorPanelId: ADMIN_ID,
    enContextoPanel: (fn) => ejecutarConContextoDb({ modo: 'panel', actor: adminActor }, fn),
  }))
})
