import { randomBytes, randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { RepositorioDonaciones } from '@/modules/donaciones/application/ports/repositorio-donaciones'
import { Donacion, type DonacionId } from '@/modules/donaciones/domain/donacion'
import type { LineaApoyo } from '@/modules/donaciones/domain/linea-apoyo'
import { importeDesdePesos } from '@/shared/domain/importe'

const ALFABETO_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function generarReferencia(): string {
  const bytes = randomBytes(21)
  let sufijo = ''
  for (const b of bytes) {
    sufijo += ALFABETO_CROCKFORD[b % 32] ?? '0'
  }
  return `DON-${sufijo}`
}

export type ContextoRepositorioDonaciones = Readonly<{
  repositorio: RepositorioDonaciones
  asegurarDonante: () => Promise<string>
  enContextoPanel: <T>(fn: () => Promise<T>) => Promise<T>
}>

function crearDonacionBase(params: {
  donanteId: string
  montoPesos?: number
  linea?: LineaApoyo
  correo?: string
  creadaEn?: Date
  id?: string
  referencia?: string
  claveIdempotencia?: string
}): Donacion {
  return Donacion.crear(
    {
      id: (params.id ?? randomUUID()) as DonacionId,
      referencia: params.referencia ?? generarReferencia(),
      claveIdempotencia: params.claveIdempotencia ?? randomUUID(),
      importe: importeDesdePesos(params.montoPesos ?? 50_000),
      linea: params.linea ?? 'educacion',
      donanteId: params.donanteId,
      pagador: {
        nombres: 'Ana María',
        apellidos: 'Muñoz Ortega',
        correo: params.correo ?? `ana.${randomUUID().slice(0, 8)}@proinserco.test`,
      },
      quiereCertificado: true,
    },
    params.creadaEn ?? new Date('2026-11-16T15:00:00.000Z'),
  )
}

/**
 * Suite de contrato compartida para `RepositorioDonaciones` (Memoria y PostgreSQL).
 */
export function probarContratoRepositorioDonaciones(
  crearContexto: () => Promise<ContextoRepositorioDonaciones> | ContextoRepositorioDonaciones,
): void {
  describe('contrato de RepositorioDonaciones', () => {
    it('insertar persiste en estado creada y rechaza referencia o claveIdempotencia duplicada', async () => {
      const { repositorio, asegurarDonante } = await crearContexto()
      const donanteId = await asegurarDonante()
      const original = crearDonacionBase({ donanteId })

      await repositorio.insertar(original)

      const dupReferencia = crearDonacionBase({
        donanteId,
        referencia: original.datos.referencia,
      })
      await expect(repositorio.insertar(dupReferencia)).rejects.toThrow()

      const dupClave = crearDonacionBase({
        donanteId,
        claveIdempotencia: original.datos.claveIdempotencia,
      })
      await expect(repositorio.insertar(dupClave)).rejects.toThrow()

      const guardada = await repositorio.buscarPorId(original.id)
      expect(guardada?.id).toBe(original.id)
      expect(guardada?.estado).toBe('creada')
    })

    it('actualizarSiEstado aplica solo si coincide estadoEsperado y permite exactamente 1 ganadora bajo Promise.all', async () => {
      const { repositorio, asegurarDonante } = await crearContexto()
      const donanteId = await asegurarDonante()
      const t0 = new Date('2026-11-16T15:00:00.000Z')
      const t1 = new Date('2026-11-16T15:01:00.000Z')
      const t2 = new Date('2026-11-16T15:02:00.000Z')
      const t3 = new Date('2026-11-16T15:03:00.000Z')

      const creada = crearDonacionBase({ donanteId, creadaEn: t0 })
      await repositorio.insertar(creada)

      const pendiente = creada.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/123', t1)
      // Si el estado esperado no coincide, no actualiza ni registra transición
      expect(await repositorio.actualizarSiEstado(pendiente, 'pendiente')).toBe(false)
      expect((await repositorio.buscarPorId(creada.id))?.estado).toBe('creada')

      expect(await repositorio.actualizarSiEstado(pendiente, 'creada')).toBe(true)
      // Repetir con estadoEsperado 'creada' ya no aplica
      expect(await repositorio.actualizarSiEstado(pendiente, 'creada')).toBe(false)

      const aprobada = pendiente.transicionar('aprobada', t2, 'webhook', { metodoPago: 'card' })
      const rechazada = pendiente.transicionar('rechazada', t3, 'conciliacion')

      const [ganoAprobada, ganoRechazada] = await Promise.all([
        repositorio.actualizarSiEstado(aprobada, 'pendiente'),
        repositorio.actualizarSiEstado(rechazada, 'pendiente'),
      ])

      expect([ganoAprobada, ganoRechazada].filter(Boolean)).toHaveLength(1)
      expect(ganoAprobada).not.toBe(ganoRechazada)

      const final = await repositorio.buscarPorId(creada.id)
      expect(final?.estado).toBe(ganoAprobada ? 'aprobada' : 'rechazada')
      expect(final?.datos.historial).toHaveLength(2)
      expect(final?.datos.historial[0]).toEqual({ desde: 'creada', hacia: 'pendiente', en: t1, origen: 'servidor' })
      expect(final?.datos.historial[1]).toEqual(
        ganoAprobada
          ? { desde: 'pendiente', hacia: 'aprobada', en: t2, origen: 'webhook' }
          : { desde: 'pendiente', hacia: 'rechazada', en: t3, origen: 'conciliacion' },
      )
    })

    it('buscarPorId, buscarPorReferencia, buscarPorIdCargo y buscarIntentoPorClave manejan aciertos, ausencias y no-UUID', async () => {
      const { repositorio, asegurarDonante } = await crearContexto()
      const donanteId = await asegurarDonante()
      const t0 = new Date('2026-11-16T15:00:00.000Z')
      const t1 = new Date('2026-11-16T15:01:00.000Z')
      const idCargo = `chg_${randomUUID()}`

      const creada = crearDonacionBase({ donanteId, creadaEn: t0, montoPesos: 75_000 })
      await repositorio.insertar(creada)
      const pendiente = creada.registrarCargo(idCargo, 'https://sandbox.openpay.co/pay/456', t1)
      expect(await repositorio.actualizarSiEstado(pendiente, 'creada')).toBe(true)

      const porId = await repositorio.buscarPorId(creada.id)
      const porRef = await repositorio.buscarPorReferencia(creada.datos.referencia)
      const porCargo = await repositorio.buscarPorIdCargo(idCargo)
      const porClave = await repositorio.buscarIntentoPorClave(creada.datos.claveIdempotencia)
      expect(porClave).toEqual({
        referencia: creada.datos.referencia,
        estado: 'pendiente',
        urlPago: 'https://sandbox.openpay.co/pay/456',
      })

      for (const encontrada of [porId, porRef, porCargo]) {
        expect(encontrada?.id).toBe(creada.id)
        expect(encontrada?.estado).toBe('pendiente')
        expect(encontrada?.datos.importe).toEqual({ centavos: 7_500_000n, moneda: 'COP' })
        expect(encontrada?.datos.idCargo).toBe(idCargo)
        expect(encontrada?.datos.historial).toHaveLength(1)
      }

      expect(await repositorio.buscarPorId(randomUUID())).toBeNull()
      expect(await repositorio.buscarPorId('no-es-uuid')).toBeNull()
      expect(await repositorio.buscarPorReferencia(generarReferencia())).toBeNull()
      expect(await repositorio.buscarPorIdCargo(`chg_inexistente_${randomUUID()}`)).toBeNull()
      expect(await repositorio.buscarIntentoPorClave(randomUUID())).toBeNull()
      expect(await repositorio.buscarIntentoPorClave('clave-no-uuid')).toBeNull()
    })

    it('lecturas públicas: resumen sin datos personales por referencia y reserva atómica de consulta a la pasarela', async () => {
      const { repositorio, asegurarDonante } = await crearContexto()
      const donanteId = await asegurarDonante()
      const t0 = new Date('2026-11-16T15:00:00.000Z')
      const creada = crearDonacionBase({ donanteId, creadaEn: t0, montoPesos: 42_000 })
      await repositorio.insertar(creada)

      const resumen = await repositorio.buscarResumenPublico(creada.datos.referencia)
      expect(resumen).toEqual({
        referencia: creada.datos.referencia,
        estado: 'creada',
        importe: { centavos: 4_200_000n, moneda: 'COP' },
        creadaEn: t0,
        quiereCertificado: creada.datos.quiereCertificado,
      })
      expect(JSON.stringify(resumen, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('@')
      expect(await repositorio.buscarResumenPublico(generarReferencia())).toBeNull()
      expect(await repositorio.buscarResumenPublico('no-es-referencia')).toBeNull()

      // Primera reserva gana; las siguientes dentro del intervalo no (aunque sean simultáneas).
      const reservas = await Promise.all([
        repositorio.reservarConsultaPasarela(creada.datos.referencia, 60),
        repositorio.reservarConsultaPasarela(creada.datos.referencia, 60),
      ])
      expect(reservas.filter(Boolean)).toHaveLength(1)
      expect(await repositorio.reservarConsultaPasarela(creada.datos.referencia, 60)).toBe(false)
      expect(await repositorio.reservarConsultaPasarela(generarReferencia(), 60)).toBe(false)
    })

    it('listar filtra, ordena por fecha/monto/estado en asc/desc, pagina por cursor sin duplicados y rechaza cursores inválidos', async () => {
      const { repositorio, asegurarDonante, enContextoPanel } = await crearContexto()
      const donanteId = await asegurarDonante()
      const tag = randomUUID().slice(0, 8)

      const t0 = new Date('2026-11-10T10:00:00.000Z')
      const t1 = new Date('2026-11-11T10:00:00.000Z')
      const t2 = new Date('2026-11-12T10:00:00.000Z')
      const t3 = new Date('2026-11-13T10:00:00.000Z')

      const d1 = crearDonacionBase({
        donanteId,
        montoPesos: 10_000,
        linea: 'educacion',
        correo: `ana_vip+${tag}@proinserco.test`,
        creadaEn: t0,
      })
      const d2 = crearDonacionBase({
        donanteId,
        montoPesos: 50_000,
        linea: 'salud',
        correo: `luis+${tag}@proinserco.test`,
        creadaEn: t1,
      })
      const d3 = crearDonacionBase({
        donanteId,
        montoPesos: 30_000,
        linea: 'educacion',
        correo: `sofia+${tag}@proinserco.test`,
        creadaEn: t2,
      })
      const d4 = crearDonacionBase({
        donanteId,
        montoPesos: 50_000,
        linea: 'agricola',
        correo: `carla+${tag}@proinserco.test`,
        creadaEn: t2,
      })
      const d5 = crearDonacionBase({
        donanteId,
        montoPesos: 80_000,
        linea: 'donde-mas-se-necesite',
        correo: `diego+${tag}@proinserco.test`,
        creadaEn: t3,
      })

      for (const d of [d1, d2, d3, d4, d5]) {
        await repositorio.insertar(d)
      }

      // Transicionar estados variados (incluyendo empate en 'pendiente')
      const d1Pend = d1.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/1', t0)
      await repositorio.actualizarSiEstado(d1Pend, 'creada')
      await repositorio.actualizarSiEstado(d1Pend.transicionar('aprobada', t0, 'webhook'), 'pendiente')

      const d2Pend = d2.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/2', t1)
      await repositorio.actualizarSiEstado(d2Pend, 'creada')

      const d3Pend = d3.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/3', t2)
      await repositorio.actualizarSiEstado(d3Pend, 'creada')
      await repositorio.actualizarSiEstado(d3Pend.transicionar('rechazada', t2, 'conciliacion'), 'pendiente')

      const d4Pend = d4.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/4', t2)
      await repositorio.actualizarSiEstado(d4Pend, 'creada')
      // d5 permanece en 'creada'

      // 1. Filtros individuales y combinados
      const porEstado = await enContextoPanel(() => repositorio.listar({ estado: 'pendiente', q: tag }, { limite: 10 }))
      expect(porEstado.total).toBe(2)
      expect(new Set(porEstado.elementos.map((d) => d.id))).toEqual(new Set([d2.id, d4.id]))

      const porLinea = await enContextoPanel(() => repositorio.listar({ linea: 'educacion', q: tag }, { limite: 10 }))
      expect(porLinea.total).toBe(2)
      expect(new Set(porLinea.elementos.map((d) => d.id))).toEqual(new Set([d1.id, d3.id]))

      const porFechas = await enContextoPanel(() => repositorio.listar({ desde: t1, hasta: t2, q: tag }, { limite: 10 }))
      expect(porFechas.total).toBe(3)
      expect(new Set(porFechas.elementos.map((d) => d.id))).toEqual(new Set([d2.id, d3.id, d4.id]))

      const porCentavos = await enContextoPanel(() =>
        repositorio.listar({ minCentavos: 3_000_000n, maxCentavos: 5_000_000n, q: tag }, { limite: 10 }),
      )
      expect(porCentavos.total).toBe(3)
      expect(new Set(porCentavos.elementos.map((d) => d.id))).toEqual(new Set([d2.id, d3.id, d4.id]))

      // Búsqueda q por referencia (insensible a mayúsculas) y correo con literal `_` escapado
      const porRef = await enContextoPanel(() => repositorio.listar({ q: d3.datos.referencia.toLowerCase() }, { limite: 10 }))
      expect(porRef.total).toBe(1)
      expect(porRef.elementos[0]?.id).toBe(d3.id)

      const porGuionBajo = await enContextoPanel(() => repositorio.listar({ q: `ANA_VIP+${tag}` }, { limite: 10 }))
      expect(porGuionBajo.total).toBe(1)
      expect(porGuionBajo.elementos[0]?.id).toBe(d1.id)

      const comodinNoLiteral = await enContextoPanel(() => repositorio.listar({ q: `ana%vip+${tag}` }, { limite: 10 }))
      expect(comodinNoLiteral.total).toBe(0)

      // 2. Ordenación (fecha, monto, estado en asc/desc) y paginación por cursor sin duplicados ni omisiones
      const criterios: Array<{ orden: 'fecha' | 'monto' | 'estado'; dir: 'asc' | 'desc' }> = [
        { orden: 'fecha', dir: 'asc' },
        { orden: 'fecha', dir: 'desc' },
        { orden: 'monto', dir: 'asc' },
        { orden: 'monto', dir: 'desc' },
        { orden: 'estado', dir: 'asc' },
        { orden: 'estado', dir: 'desc' },
      ]

      const todosLosIds = new Set([d1.id, d2.id, d3.id, d4.id, d5.id])
      for (const { orden, dir } of criterios) {
        const recolectadas: Donacion[] = []
        let cursor: string | undefined
        let totalReportado = -1

        for (let paso = 0; paso < 5; paso++) {
          const pagina = await enContextoPanel(() =>
            repositorio.listar({ q: tag, orden, dir }, { limite: 2, ...(cursor ? { cursor } : {}) }),
          )
          if (totalReportado === -1) totalReportado = pagina.total
          expect(pagina.total).toBe(5)
          recolectadas.push(...pagina.elementos)
          if (!pagina.cursorSiguiente) {
            cursor = undefined
            break
          }
          cursor = pagina.cursorSiguiente
        }

        expect(cursor).toBeUndefined()
        expect(recolectadas).toHaveLength(5)
        expect(new Set(recolectadas.map((d) => d.id))).toEqual(todosLosIds)

        const claves = recolectadas.map((d) =>
          orden === 'monto'
            ? d.datos.importe.centavos.toString().padStart(20, '0')
            : orden === 'estado'
              ? d.estado
              : d.datos.creadaEn.toISOString(),
        )
        for (let i = 1; i < claves.length; i++) {
          const prev = claves[i - 1] ?? ''
          const curr = claves[i] ?? ''
          if (dir === 'asc') {
            expect(prev <= curr).toBe(true)
          } else {
            expect(prev >= curr).toBe(true)
          }
          if (prev === curr) {
            const prevId = recolectadas[i - 1]?.id ?? ''
            const currId = recolectadas[i]?.id ?? ''
            expect(dir === 'asc' ? prevId < currId : prevId > currId).toBe(true)
          }
        }
      }

      // 3. Invalidación segura de cursor manipulado o de otro criterio de orden
      const p1FechaDesc = await enContextoPanel(() => repositorio.listar({ q: tag, orden: 'fecha', dir: 'desc' }, { limite: 2 }))
      expect(p1FechaDesc.cursorSiguiente).not.toBeNull()

      const p1MontoAsc = await enContextoPanel(() => repositorio.listar({ q: tag, orden: 'monto', dir: 'asc' }, { limite: 2 }))
      const conCursorOtroOrden = await enContextoPanel(() =>
        repositorio.listar(
          { q: tag, orden: 'monto', dir: 'asc' },
          { limite: 2, cursor: p1FechaDesc.cursorSiguiente ?? undefined },
        ),
      )
      expect(conCursorOtroOrden.elementos.map((d) => d.id)).toEqual(p1MontoAsc.elementos.map((d) => d.id))

      for (const cursorInvalido of [
        'cursor-manipulado!!',
        Buffer.from('{no-es-json').toString('base64url'),
        Buffer.from('{"en":"sin-id"}').toString('base64url'),
      ]) {
        const reinicio = await enContextoPanel(() =>
          repositorio.listar({ q: tag, orden: 'fecha', dir: 'desc' }, { limite: 2, cursor: cursorInvalido }),
        )
        expect(reinicio.elementos.map((d) => d.id)).toEqual(p1FechaDesc.elementos.map((d) => d.id))
      }

      // Listado sin filtros pagina sin repetir ni romper
      const sinFiltrosP1 = await enContextoPanel(() => repositorio.listar({}, { limite: 2 }))
      expect(sinFiltrosP1.total).toBeGreaterThanOrEqual(5)
      expect(sinFiltrosP1.elementos).toHaveLength(2)
      expect(sinFiltrosP1.cursorSiguiente).not.toBeNull()
      const sinFiltrosP2 = await enContextoPanel(() =>
        repositorio.listar({}, { limite: 2, cursor: sinFiltrosP1.cursorSiguiente ?? undefined }),
      )
      const idsP1 = new Set(sinFiltrosP1.elementos.map((d) => d.id))
      for (const e of sinFiltrosP2.elementos) {
        expect(idsP1.has(e.id)).toBe(false)
      }
    })

    it('listarDesde filtra por fecha mínima inclusive y ordena descendente por fecha con historial', async () => {
      const { repositorio, asegurarDonante, enContextoPanel } = await crearContexto()
      const donanteId = await asegurarDonante()
      const tAntes = new Date('2026-10-01T10:00:00.000Z')
      const tLimite = new Date('2026-10-05T10:00:00.000Z')
      const tDespues = new Date('2026-10-06T10:00:00.000Z')

      const vieja = crearDonacionBase({ donanteId, creadaEn: tAntes })
      const enLimite = crearDonacionBase({ donanteId, creadaEn: tLimite })
      const reciente = crearDonacionBase({ donanteId, creadaEn: tDespues })

      for (const d of [vieja, enLimite, reciente]) {
        await repositorio.insertar(d)
      }
      const recientePend = reciente.registrarCargo(`chg_${randomUUID()}`, 'https://sandbox.openpay.co/pay/999', tDespues)
      await repositorio.actualizarSiEstado(recientePend, 'creada')

      const lista = await enContextoPanel(() => repositorio.listarDesde(tLimite))
      const ids = lista.map((d) => d.id)

      expect(ids).not.toContain(vieja.id)
      expect(ids).toContain(enLimite.id)
      expect(ids).toContain(reciente.id)
      expect(ids.indexOf(reciente.id)).toBeLessThan(ids.indexOf(enLimite.id))

      for (let i = 0; i < lista.length; i++) {
        const actual = lista[i]
        expect(actual).toBeDefined()
        if (!actual) continue
        expect(actual.datos.creadaEn.getTime()).toBeGreaterThanOrEqual(tLimite.getTime())
        if (i > 0) {
          const anterior = lista[i - 1]
          expect(anterior).toBeDefined()
          if (anterior) {
            expect(anterior.datos.creadaEn.getTime()).toBeGreaterThanOrEqual(actual.datos.creadaEn.getTime())
          }
        }
      }

      const encontradaReciente = lista.find((d) => d.id === reciente.id)
      expect(encontradaReciente?.datos.historial).toHaveLength(1)
    })
  })
}
