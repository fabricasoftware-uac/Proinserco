import { randomUUID } from 'node:crypto'
import { describe } from 'vitest'
import { crearLimitadorMemoria } from '@/shared/infrastructure/limitador-memoria'
import { crearLimitadorRedis } from '@/shared/infrastructure/limitador-redis'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'
import { probarContratoLimitadorDeTasa } from '@/test/contratos/limitador-de-tasa.contrato'

describe('LimitadorDeTasa en Memoria — contrato', () => {
  probarContratoLimitadorDeTasa(() => {
    const reloj = crearRelojFijo(new Date('2026-11-16T15:00:00.000Z'))
    const limitador = crearLimitadorMemoria(reloj)
    return {
      limitador,
      prefijoClave: `test-mem-${randomUUID()}`,
      avanzarVentana: async (segundos) => {
        reloj.avanzar((segundos + 1) * 1000)
      },
    }
  })
})

const redisUrl = process.env.TEST_REDIS_URL

describe.runIf(Boolean(redisUrl))('LimitadorDeTasa en Redis — contrato', () => {
  const limitador = redisUrl ? crearLimitadorRedis(redisUrl) : null

  probarContratoLimitadorDeTasa(() => {
    if (!limitador) throw new Error('TEST_REDIS_URL requerida')
    return {
      limitador,
      prefijoClave: `test-redis-${randomUUID()}`,
      avanzarVentana: (segundos) => new Promise((resolve) => setTimeout(resolve, (segundos + 1) * 1000)),
    }
  })
})
