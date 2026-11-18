import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe } from 'vitest'
import { crearRepositorioDonacionesMemoria } from '@/modules/donaciones/infrastructure/repositorio-donaciones-memoria'
import { crearRepositorioDonacionesPostgres } from '@/modules/donaciones/infrastructure/repositorio-donaciones-postgres'
import type { DonanteId } from '@/modules/donantes/domain/donante'
import { crearRepositorioDonantesPostgres } from '@/modules/donantes/infrastructure/repositorios-postgres'
import { PERMISOS_POR_ROL } from '@/modules/iam/domain/roles'
import { cerrarDb } from '@/server/db/cliente'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { Actor } from '@/shared/domain/actor'
import { probarContratoRepositorioDonaciones } from '@/test/contratos/repositorio-donaciones.contrato'

describe('RepositorioDonaciones en Memoria — contrato', () => {
  probarContratoRepositorioDonaciones(() => ({
    repositorio: crearRepositorioDonacionesMemoria(),
    asegurarDonante: async () => randomUUID(),
    enContextoPanel: (fn) => fn(),
  }))
})

const testDatabaseUrl = process.env.TEST_DATABASE_URL

describe.runIf(Boolean(testDatabaseUrl))('RepositorioDonaciones en PostgreSQL — contrato', () => {
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

  probarContratoRepositorioDonaciones(() => {
    const repoDonaciones = crearRepositorioDonacionesPostgres()
    const repoDonantes = crearRepositorioDonantesPostgres()

    return {
      repositorio: repoDonaciones,
      asegurarDonante: async () => {
        const sufijo = randomUUID().replaceAll('-', '').slice(0, 12)
        const donanteId = randomUUID() as DonanteId
        const ahora = new Date('2026-11-16T15:00:00.000Z')
        await repoDonantes.guardar({
          id: donanteId,
          nombres: 'Donante Contrato',
          apellidos: 'Proinserco Test',
          tipoDocumento: 'CC',
          numeroDocumento: `9${sufijo}`,
          correo: `donante.${sufijo}@proinserco.test`,
          celular: '+573001234567',
          quiereCertificado: true,
          creadoEn: ahora,
          actualizadoEn: ahora,
        })
        return donanteId
      },
      enContextoPanel: (fn) => ejecutarConContextoDb({ modo: 'panel', actor: adminActor }, fn),
    }
  })
})
