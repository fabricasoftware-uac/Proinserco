import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { RegistroAuditoria } from '@/modules/auditoria/application/ports/registro-auditoria'
import type { EntradaAuditoria } from '@/modules/auditoria/domain/entrada-auditoria'

export type ContextoRegistroAuditoria = Readonly<{
  registro: RegistroAuditoria
  actorPanelId: string
  enContextoPanel: <T>(fn: () => Promise<T>) => Promise<T>
}>

function crearEntrada(overrides: Partial<EntradaAuditoria> & Pick<EntradaAuditoria, 'actorId' | 'ocurridoEn'>): EntradaAuditoria {
  return {
    id: randomUUID(),
    accion: 'sesion.iniciada',
    recurso: 'sesion',
    recursoId: null,
    ip: '192.0.2.10',
    detalles: { metodo: 'totp' },
    ...overrides,
  }
}

/**
 * Suite de contrato compartida para `RegistroAuditoria` (Memoria y PostgreSQL).
 */
export function probarContratoRegistroAuditoria(
  crearContexto: () => Promise<ContextoRegistroAuditoria> | ContextoRegistroAuditoria,
): void {
  describe('contrato de RegistroAuditoria', () => {
    it('insertar persiste entradas de sistema y de panel (incluyendo ip desconocida o null)', async () => {
      const { registro, actorPanelId, enContextoPanel } = await crearContexto()
      const recursoTag = randomUUID()
      const t1 = new Date('2026-11-16T10:00:00.000Z')
      const t2 = new Date('2026-11-16T10:01:00.000Z')
      const t3 = new Date('2026-11-16T10:02:00.000Z')

      const eSistema = crearEntrada({
        actorId: `sistema_${recursoTag.slice(0, 8)}`,
        accion: 'donacion.creada',
        recurso: 'donacion',
        recursoId: recursoTag,
        ip: 'desconocida',
        ocurridoEn: t1,
        detalles: { linea: 'educacion' },
      })
      const eNullIp = crearEntrada({
        actorId: `sistema_${recursoTag.slice(0, 8)}`,
        accion: 'sesion.fallida',
        recurso: 'sesion',
        recursoId: recursoTag,
        ip: null,
        ocurridoEn: t2,
        detalles: { motivo: 'credenciales' },
      })
      const ePanel = crearEntrada({
        actorId: actorPanelId,
        accion: 'ajustes.cambiados',
        recurso: 'ajustes',
        recursoId: recursoTag,
        ip: '192.0.2.50',
        ocurridoEn: t3,
        detalles: { campo: 'limites' },
      })

      await registro.insertar(eSistema)
      await registro.insertar(eNullIp)
      await enContextoPanel(() => registro.insertar(ePanel))

      const pagina = await enContextoPanel(() => registro.listar({ recursoId: recursoTag }, { limite: 10 }))
      expect(pagina.total).toBe(3)
      expect(pagina.elementos.map((e) => e.id)).toEqual([ePanel.id, eNullIp.id, eSistema.id])
      expect(pagina.elementos[0]?.ip).toBe('192.0.2.50')
      expect(pagina.elementos[1]?.ip).toBeNull()
      expect(pagina.elementos[2]?.ip === null || pagina.elementos[2]?.ip === 'desconocida').toBe(true)
    })

    it('listar filtra por accion, actorId, recurso, recursoId, desde y hasta', async () => {
      const { registro, enContextoPanel } = await crearContexto()
      const actorUno = `actor-a-${randomUUID().slice(0, 8)}`
      const actorDos = `actor-b-${randomUUID().slice(0, 8)}`
      const recursoTag = randomUUID()

      const t0 = new Date('2026-11-10T10:00:00.000Z')
      const t1 = new Date('2026-11-11T10:00:00.000Z')
      const t2 = new Date('2026-11-12T10:00:00.000Z')
      const t3 = new Date('2026-11-13T10:00:00.000Z')

      const e1 = crearEntrada({
        actorId: actorUno,
        accion: 'sesion.iniciada',
        recurso: 'sesion',
        recursoId: recursoTag,
        ocurridoEn: t0,
      })
      const e2 = crearEntrada({
        actorId: actorUno,
        accion: 'sesion.fallida',
        recurso: 'sesion',
        recursoId: recursoTag,
        ocurridoEn: t1,
      })
      const e3 = crearEntrada({
        actorId: actorDos,
        accion: 'donacion.transicion',
        recurso: 'donacion',
        recursoId: recursoTag,
        ocurridoEn: t2,
      })
      const e4 = crearEntrada({
        actorId: actorDos,
        accion: 'sesion.fallida',
        recurso: 'otra-entidad',
        recursoId: `otro-${recursoTag}`,
        ocurridoEn: t3,
      })

      for (const e of [e1, e2, e3, e4]) {
        await registro.insertar(e)
      }

      const porAccionYActor = await enContextoPanel(() =>
        registro.listar({ accion: 'sesion.fallida', actorId: actorUno }, { limite: 10 }),
      )
      expect(porAccionYActor.total).toBe(1)
      expect(porAccionYActor.elementos[0]?.id).toBe(e2.id)

      const porRecurso = await enContextoPanel(() =>
        registro.listar({ recurso: 'donacion', recursoId: recursoTag }, { limite: 10 }),
      )
      expect(porRecurso.total).toBe(1)
      expect(porRecurso.elementos[0]?.id).toBe(e3.id)

      const porRango = await enContextoPanel(() =>
        registro.listar({ recursoId: recursoTag, desde: t1, hasta: t2 }, { limite: 10 }),
      )
      expect(porRango.total).toBe(2)
      expect(porRango.elementos.map((e) => e.id)).toEqual([e3.id, e2.id])
    })

    it('listar pagina por cursor sin repeticiones ni omisiones y maneja cursores inválidos', async () => {
      const { registro, enContextoPanel } = await crearContexto()
      const actorLote = `actor-pag-${randomUUID().slice(0, 8)}`
      const t0 = new Date('2026-11-01T10:00:00.000Z')
      const t1 = new Date('2026-11-02T10:00:00.000Z')
      const t2 = new Date('2026-11-03T10:00:00.000Z')
      const t3 = new Date('2026-11-04T10:00:00.000Z')

      const entradas = [
        crearEntrada({ actorId: actorLote, accion: 'sesion.iniciada', ocurridoEn: t0 }),
        crearEntrada({ actorId: actorLote, accion: 'sesion.fallida', ocurridoEn: t1 }),
        // Dos eventos en el mismo instante t2 para validar desempate determinista por id
        crearEntrada({ actorId: actorLote, accion: 'donacion.creada', ocurridoEn: t2 }),
        crearEntrada({ actorId: actorLote, accion: 'donacion.transicion', ocurridoEn: t2 }),
        crearEntrada({ actorId: actorLote, accion: 'sesion.cerrada', ocurridoEn: t3 }),
      ]

      for (const e of entradas) {
        await registro.insertar(e)
      }

      const recolectadas: EntradaAuditoria[] = []
      let cursor: string | undefined
      for (let paso = 0; paso < 5; paso++) {
        const pagina = await enContextoPanel(() =>
          registro.listar({ actorId: actorLote }, { limite: 2, ...(cursor ? { cursor } : {}) }),
        )
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
      expect(new Set(recolectadas.map((e) => e.id))).toEqual(new Set(entradas.map((e) => e.id)))

      for (let i = 1; i < recolectadas.length; i++) {
        const prev = recolectadas[i - 1]
        const curr = recolectadas[i]
        expect(prev).toBeDefined()
        expect(curr).toBeDefined()
        if (!prev || !curr) continue
        expect(prev.ocurridoEn.getTime()).toBeGreaterThanOrEqual(curr.ocurridoEn.getTime())
        if (prev.ocurridoEn.getTime() === curr.ocurridoEn.getTime()) {
          expect(prev.id > curr.id).toBe(true)
        }
      }

      const p1 = await enContextoPanel(() => registro.listar({ actorId: actorLote }, { limite: 2 }))
      for (const invalido of [
        'cursor-corrupto!!',
        Buffer.from('{no-json').toString('base64url'),
        Buffer.from('{"en":"sin-id"}').toString('base64url'),
      ]) {
        const reinicio = await enContextoPanel(() => registro.listar({ actorId: actorLote }, { limite: 2, cursor: invalido }))
        expect(reinicio.elementos.map((e) => e.id)).toEqual(p1.elementos.map((e) => e.id))
      }

      // Listado sin filtros pagina sin repeticiones
      const sinFiltroP1 = await enContextoPanel(() => registro.listar({}, { limite: 2 }))
      expect(sinFiltroP1.total).toBeGreaterThanOrEqual(5)
      expect(sinFiltroP1.elementos).toHaveLength(2)
      expect(sinFiltroP1.cursorSiguiente).not.toBeNull()
      const sinFiltroP2 = await enContextoPanel(() =>
        registro.listar({}, { limite: 2, cursor: sinFiltroP1.cursorSiguiente ?? undefined }),
      )
      const idsP1 = new Set(sinFiltroP1.elementos.map((e) => e.id))
      for (const e of sinFiltroP2.elementos) {
        expect(idsP1.has(e.id)).toBe(false)
      }
    })
  })
}
