import { describe, expect, it } from 'vitest'
import { importeDesdePesos } from '@/shared/domain/importe'
import { Donacion, type DonacionId } from './donacion'
import { MontoFueraDeRango, TransicionInvalida } from './errores'
import { type EstadoDonacion, esTransicionValida, TRANSICIONES } from './estado-donacion'
import { importeDeDonacion } from './monto'

const ahora = new Date('2026-11-16T12:00:00Z')

function nueva() {
  return Donacion.crear(
    {
      id: 'd1' as DonacionId,
      referencia: 'DON-000000000000000000001',
      claveIdempotencia: 'k1',
      importe: importeDesdePesos(50_000),
      linea: 'salud',
      donanteId: 'x',
      pagador: { nombres: 'A', apellidos: 'B', correo: 'a@b.test' },
      quiereCertificado: false,
    },
    ahora,
  )
}

describe('máquina de estados de la donación', () => {
  it('nace en `creada` y pasa a `pendiente` al registrar el cargo', () => {
    const d = nueva().registrarCargo('cargo-1', 'https://pago.test', ahora)
    expect(d.estado).toBe('pendiente')
    expect(d.datos.idCargo).toBe('cargo-1')
    expect(d.datos.historial).toHaveLength(1)
  })

  it('no permite pasar de rechazada a aprobada', () => {
    const rechazada = nueva().registrarCargo('c', 'u', ahora).transicionar('rechazada', ahora, 'webhook')
    expect(() => rechazada.transicionar('aprobada', ahora, 'webhook')).toThrow(TransicionInvalida)
  })

  it('no permite aprobar sin pasar por pendiente', () => {
    expect(() => nueva().transicionar('aprobada', ahora, 'webhook')).toThrow(TransicionInvalida)
  })

  it('solo una aprobada puede reembolsarse o tener contracargo', () => {
    const aprobada = nueva().registrarCargo('c', 'u', ahora).transicionar('aprobada', ahora, 'webhook')
    expect(aprobada.transicionar('reembolsada', ahora, 'panel').estado).toBe('reembolsada')
    expect(aprobada.transicionar('contracargo', ahora, 'webhook').estado).toBe('contracargo')
  })

  it('los estados finales no tienen salida', () => {
    for (const final of ['rechazada', 'expirada', 'reembolsada', 'contracargo'] satisfies EstadoDonacion[]) {
      expect(TRANSICIONES[final]).toHaveLength(0)
    }
    expect(esTransicionValida('expirada', 'pendiente')).toBe(false)
  })

  it('es inmutable: transicionar devuelve otra instancia', () => {
    const original = nueva()
    original.registrarCargo('c', 'u', ahora)
    expect(original.estado).toBe('creada')
  })
})

describe('monto de la donación (decidido en servidor)', () => {
  const limites = { minimoPesos: 10_000, maximoPesos: 20_000_000 }

  it('convierte pesos a centavos en bigint', () => {
    expect(importeDeDonacion(50_000, limites)).toEqual({ centavos: 5_000_000n, moneda: 'COP' })
  })

  it.each([1, 9_999, 20_000_001, 1.5, -100])('rechaza %s pesos (fuera de rango o no entero)', (monto) => {
    expect(() => importeDeDonacion(monto, limites)).toThrow(MontoFueraDeRango)
  })
})
