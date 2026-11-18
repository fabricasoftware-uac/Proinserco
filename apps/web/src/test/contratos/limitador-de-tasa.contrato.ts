import { describe, expect, it } from 'vitest'
import type { LimitadorDeTasa } from '@/shared/application/ports/limitador-de-tasa'

export type ContextoLimitadorContrato = Readonly<{
  limitador: LimitadorDeTasa
  prefijoClave: string
  avanzarVentana: (segundos: number) => Promise<void>
}>

/**
 * Suite de contrato reutilizable para cualquier adaptador de `LimitadorDeTasa`
 * (Memoria, Redis, etc.). Verifica invariantes de ventana fija, aislamiento
 * entre claves, atomicidad concurrente y valores de `reintentarEnSegundos`.
 */
export function probarContratoLimitadorDeTasa(
  crearContexto: () => Promise<ContextoLimitadorContrato> | ContextoLimitadorContrato,
): void {
  describe('contrato de LimitadorDeTasa', () => {
    it('permite hasta el límite, decrementa restantes y bloquea al superarlo con reintentarEnSegundos > 0', async () => {
      const { limitador, prefijoClave } = await crearContexto()
      const clave = `${prefijoClave}:basica`

      const r1 = await limitador.consumir(clave, 3, 5)
      const r2 = await limitador.consumir(clave, 3, 5)
      const r3 = await limitador.consumir(clave, 3, 5)
      const r4 = await limitador.consumir(clave, 3, 5)
      const r5 = await limitador.consumir(clave, 3, 5)

      expect(r1).toEqual({ permitido: true, restantes: 2, reintentarEnSegundos: 0 })
      expect(r2).toEqual({ permitido: true, restantes: 1, reintentarEnSegundos: 0 })
      expect(r3).toEqual({ permitido: true, restantes: 0, reintentarEnSegundos: 0 })

      expect(r4.permitido).toBe(false)
      expect(r4.restantes).toBe(0)
      expect(r4.reintentarEnSegundos).toBeGreaterThan(0)
      expect(r4.reintentarEnSegundos).toBeLessThanOrEqual(5)

      expect(r5.permitido).toBe(false)
      expect(r5.restantes).toBe(0)
      expect(r5.reintentarEnSegundos).toBeGreaterThan(0)
      expect(r5.reintentarEnSegundos).toBeLessThanOrEqual(5)
    })

    it('aísla contadores entre claves distintas (a vs b y claves :id:)', async () => {
      const { limitador, prefijoClave } = await crearContexto()
      const claveA = `${prefijoClave}:a`
      const claveB = `${prefijoClave}:b`

      for (let i = 0; i < 2; i++) {
        expect((await limitador.consumir(claveA, 2, 10)).permitido).toBe(true)
      }
      const bloqueadoA = await limitador.consumir(claveA, 2, 10)
      expect(bloqueadoA.permitido).toBe(false)
      expect(bloqueadoA.reintentarEnSegundos).toBeGreaterThan(0)

      const libreB = await limitador.consumir(claveB, 2, 10)
      expect(libreB).toEqual({ permitido: true, restantes: 1, reintentarEnSegundos: 0 })

      const idA = `${prefijoClave}:id:ana@proinserco.test`
      const idB = `${prefijoClave}:id:luis@proinserco.test`
      expect((await limitador.consumir(idA, 1, 10)).permitido).toBe(true)
      expect((await limitador.consumir(idA, 1, 10)).permitido).toBe(false)
      expect(await limitador.consumir(idB, 1, 10)).toEqual({ permitido: true, restantes: 0, reintentarEnSegundos: 0 })
    })

    it('reinicia la ventana fija cuando transcurre ventanaSegundos', async () => {
      const { limitador, prefijoClave, avanzarVentana } = await crearContexto()
      const clave = `${prefijoClave}:ventana`

      expect(await limitador.consumir(clave, 2, 1)).toEqual({ permitido: true, restantes: 1, reintentarEnSegundos: 0 })
      expect(await limitador.consumir(clave, 2, 1)).toEqual({ permitido: true, restantes: 0, reintentarEnSegundos: 0 })

      const bloqueado = await limitador.consumir(clave, 2, 1)
      expect(bloqueado.permitido).toBe(false)
      expect(bloqueado.restantes).toBe(0)
      expect(bloqueado.reintentarEnSegundos).toBeGreaterThan(0)

      await avanzarVentana(1)

      const reiniciado = await limitador.consumir(clave, 2, 1)
      expect(reiniciado).toEqual({ permitido: true, restantes: 1, reintentarEnSegundos: 0 })
    })

    it('aplica el límite atómicamente ante ráfagas concurrentes', async () => {
      const { limitador, prefijoClave } = await crearContexto()
      const clave = `${prefijoClave}:concurrencia`

      const resultados = await Promise.all(Array.from({ length: 5 }, () => limitador.consumir(clave, 2, 5)))
      const permitidos = resultados.filter((r) => r.permitido)
      const rechazados = resultados.filter((r) => !r.permitido)

      expect(permitidos).toHaveLength(2)
      expect(rechazados).toHaveLength(3)
      for (const rechazo of rechazados) {
        expect(rechazo.restantes).toBe(0)
        expect(rechazo.reintentarEnSegundos).toBeGreaterThan(0)
      }
    })
  })
}
