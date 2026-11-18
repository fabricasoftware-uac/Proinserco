import { afterAll, beforeAll, describe } from 'vitest'
import {
  crearRegistroConsentimientosMemoria,
  crearRepositorioDonantesMemoria,
} from '@/modules/donantes/infrastructure/repositorios-memoria'
import {
  crearRegistroConsentimientosPostgres,
  crearRepositorioDonantesPostgres,
} from '@/modules/donantes/infrastructure/repositorios-postgres'
import { PERMISOS_POR_ROL } from '@/modules/iam/domain/roles'
import { cerrarDb } from '@/server/db/cliente'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { Actor } from '@/shared/domain/actor'
import { probarContratoRepositoriosDonantes } from '@/test/contratos/repositorios-donantes.contrato'

describe('Repositorios de Donantes y Consentimientos en Memoria — contrato', () => {
  probarContratoRepositoriosDonantes(() => ({
    donantes: crearRepositorioDonantesMemoria(),
    consentimientos: crearRegistroConsentimientosMemoria(),
    enContextoPanel: (fn) => fn(),
  }))
})

const testDatabaseUrl = process.env.TEST_DATABASE_URL

describe.runIf(Boolean(testDatabaseUrl))('Repositorios de Donantes y Consentimientos en PostgreSQL — contrato', () => {
  const envPrevio = {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_URL: process.env.APP_URL,
    SESION_SECRETO: process.env.SESION_SECRETO,
  }

  const adminActor = new Actor(
    '11111111-1111-4111-8111-111111111111',
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

  probarContratoRepositoriosDonantes(() => ({
    donantes: crearRepositorioDonantesPostgres(),
    consentimientos: crearRegistroConsentimientosPostgres(),
    enContextoPanel: (fn) => ejecutarConContextoDb({ modo: 'panel', actor: adminActor }, fn),
  }))
})
