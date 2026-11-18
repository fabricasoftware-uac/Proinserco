import { describe, expect, it } from 'vitest'
import { actorDe, crearMundoMemoria, solicitudDonacion } from '@/test/mundo-memoria'
import { consultarDonaciones, consultarParaExportar } from './consulta-panel'

describe('consulta-panel', () => {
  it('usa paginación nativa por cursor y filtros/orden nativos en consultarDonaciones', async () => {
    const m = crearMundoMemoria()
    const admin = actorDe('administrador')
    for (const monto of [20_000, 80_000, 40_000, 100_000]) {
      await m.crearDonacion(solicitudDonacion(monto))
      m.reloj.avanzar(60_000)
    }

    const p1 = await consultarDonaciones(m.listarDonaciones, admin, {
      minPesos: 30_000,
      maxPesos: 90_000,
      orden: 'monto',
      dir: 'asc',
      limite: 1,
    })
    expect(p1.modo).toBe('cursor')
    expect(p1.truncado).toBe(false)
    expect(p1.total).toBe(2)
    expect(p1.hayMas).toBe(true)
    expect(p1.filas.map((f) => f.montoPesos)).toEqual([40_000])

    const p2 = await consultarDonaciones(m.listarDonaciones, admin, {
      minPesos: 30_000,
      maxPesos: 90_000,
      orden: 'monto',
      dir: 'asc',
      cursor: p1.siguienteCursor ?? undefined,
      limite: 1,
    })
    expect(p2.hayMas).toBe(false)
    expect(p2.siguienteCursor).toBeNull()
    expect(p2.filas.map((f) => f.montoPesos)).toEqual([80_000])
  })

  it('consultarParaExportar pagina por cursor hasta el tope e informa truncado con exactitud', async () => {
    const m = crearMundoMemoria()
    const admin = actorDe('administrador')
    for (const monto of [10_000, 50_000, 30_000, 70_000]) {
      await m.crearDonacion(solicitudDonacion(monto))
      m.reloj.avanzar(60_000)
    }

    const exacto = await consultarParaExportar(m.listarDonaciones, admin, { orden: 'monto', dir: 'desc', limite: 100 }, 4)
    expect(exacto.truncado).toBe(false)
    expect(exacto.filas.map((f) => f.montoPesos)).toEqual([70_000, 50_000, 30_000, 10_000])

    const recortado = await consultarParaExportar(
      m.listarDonaciones,
      admin,
      { minPesos: 20_000, orden: 'monto', dir: 'asc', limite: 100 },
      2,
    )
    expect(recortado.truncado).toBe(true)
    expect(recortado.filas.map((f) => f.montoPesos)).toEqual([30_000, 50_000])
  })
})
