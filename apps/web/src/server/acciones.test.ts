import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const { consumir } = vi.hoisted(() => ({ consumir: vi.fn() }))

vi.mock('./container', () => ({
  obtenerContenedor: async () => ({ transversal: { limitador: { consumir } } }),
}))
vi.mock('./contexto-peticion', () => ({ contextoPeticion: async () => ({ ip: '203.0.113.5', userAgent: null }) }))
vi.mock('./auth-context', () => ({ obtenerActor: async () => null }))
vi.mock('./registro', () => ({ registro: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() } }))

import { accionPublica, conLimiteDeTasa } from './acciones'

const Entrada = z.object({ correo: z.string() })

describe('conLimiteDeTasa', () => {
  beforeEach(() => {
    consumir.mockReset()
    consumir.mockResolvedValue({ permitido: true, restantes: 1, reintentarEnSegundos: 0 })
  })

  it('con identidadConIp la clave por identidad combina correo + IP (un tercero no agota el cupo de la cuenta)', async () => {
    const accion = accionPublica
      .metadata({ nombre: 'iniciar-sesion' })
      .use(
        conLimiteDeTasa({
          limite: 10,
          ventanaSegundos: 900,
          limiteIdentidad: 5,
          identidadConIp: true,
          identidad: (e) => (e as { correo: string }).correo,
        }),
      )
      .inputSchema(Entrada)
      .action(async () => 'ok')

    expect((await accion({ correo: 'Admin@Proinserco.Org' }))?.data).toBe('ok')
    expect(consumir.mock.calls.map((c) => c[0])).toEqual([
      'iniciar-sesion:ip:203.0.113.5',
      'iniciar-sesion:id:admin@proinserco.org|203.0.113.5',
    ])
  })

  it('sin identidadConIp la clave por identidad es solo la identidad (p. ej. correo del donante)', async () => {
    const accion = accionPublica
      .metadata({ nombre: 'crear-donacion' })
      .use(conLimiteDeTasa({ limite: 5, ventanaSegundos: 600, identidad: (e) => (e as { correo: string }).correo }))
      .inputSchema(Entrada)
      .action(async () => 'ok')

    await accion({ correo: 'ana@x.co' })
    expect(consumir.mock.calls[1]?.[0]).toBe('crear-donacion:id:ana@x.co')
  })
})
