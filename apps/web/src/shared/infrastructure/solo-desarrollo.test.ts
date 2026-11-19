import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearPasarelaSimulada } from '@/modules/donaciones/infrastructure/pasarela-simulada'
import { usuariosDemo } from '@/modules/iam/infrastructure/usuarios-demo'
import { crearIdsSecuenciales } from '@/test/mundo-memoria'
import { exigirEntornoNoProductivo } from './solo-desarrollo'

describe('piezas de demostración: prohibidas en producción', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('la aserción lanza con NODE_ENV=production y deja pasar en desarrollo y pruebas', () => {
    expect(() => exigirEntornoNoProductivo('X', 'production')).toThrow('prohibida con NODE_ENV=production')
    expect(() => exigirEntornoNoProductivo('X', 'development')).not.toThrow()
    expect(() => exigirEntornoNoProductivo('X', 'test')).not.toThrow()
  })

  it('la pasarela simulada y los usuarios demo NO se pueden instanciar en producción', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => crearPasarelaSimulada({ ids: crearIdsSecuenciales(), urlBase: 'https://proinserco.org' })).toThrow(
      'pasarela simulada',
    )
    expect(() => usuariosDemo()).toThrow('usuarios demo')
  })

  it('en desarrollo existen: pasarela simulada completa y dos usuarios demo con TOTP', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const pasarela = crearPasarelaSimulada({ ids: crearIdsSecuenciales(), urlBase: 'http://localhost:3000' })
    const cargo = await pasarela.crearCargo({
      referencia: 'DON-000000000000000000001',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      descripcion: 'Donación',
      pagador: { nombres: 'Ana', apellidos: 'Muñoz', correo: 'ana@demo.test' },
      urlRetorno: 'http://localhost:3000/donar/resultado',
    })
    expect(cargo.urlPago).toMatch(/^http:\/\/localhost:3000\/donar\/pasarela-simulada\?cargo=sim_/)
    expect(await pasarela.buscarCargoPorReferencia('DON-000000000000000000001')).toMatchObject({ idCargo: cargo.idCargo })
    expect(usuariosDemo().map((u) => u.rol)).toEqual(['administrador', 'consulta'])
  })
})
