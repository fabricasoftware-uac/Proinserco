import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { RegistroConsentimientos } from '@/modules/donantes/application/ports/registro-consentimientos'
import type { RepositorioDonantes } from '@/modules/donantes/application/ports/repositorio-donantes'
import type { Consentimiento, FinalidadConsentimiento } from '@/modules/donantes/domain/consentimiento'
import type { Donante, DonanteId, TipoDocumento } from '@/modules/donantes/domain/donante'

export type ContextoRepositoriosDonantes = Readonly<{
  donantes: RepositorioDonantes
  consentimientos: RegistroConsentimientos
  enContextoPanel: <T>(fn: () => Promise<T>) => Promise<T>
}>

function crearDonantePrueba(overrides: Partial<Donante> = {}): Donante {
  const sufijo = randomUUID().replaceAll('-', '').slice(0, 12)
  const ahora = new Date('2026-11-16T15:00:00.000Z')
  return {
    id: randomUUID() as DonanteId,
    nombres: 'Ana María',
    apellidos: 'Muñoz Ortega',
    tipoDocumento: 'CC' satisfies TipoDocumento,
    numeroDocumento: `1${sufijo}`,
    correo: `ana.${sufijo}@proinserco.test`,
    celular: '+573001234567',
    quiereCertificado: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  }
}

/**
 * Suite de contrato compartida para `RepositorioDonantes` y `RegistroConsentimientos`
 * (Memoria y PostgreSQL).
 */
export function probarContratoRepositoriosDonantes(
  crearContexto: () => Promise<ContextoRepositoriosDonantes> | ContextoRepositoriosDonantes,
): void {
  describe('contrato de RepositorioDonantes', () => {
    it('guardar inserta y actualiza por id sin duplicar ni alterar creadoEn', async () => {
      const { donantes, enContextoPanel } = await crearContexto()
      const tCreacion = new Date('2026-11-16T10:00:00.000Z')
      const tActualizacion = new Date('2026-11-16T12:00:00.000Z')
      const original = crearDonantePrueba({ creadoEn: tCreacion, actualizadoEn: tCreacion, quiereCertificado: false })

      const conteoInicial = await enContextoPanel(() => donantes.contar())
      await donantes.guardar(original)
      expect(await enContextoPanel(() => donantes.contar())).toBe(conteoInicial + 1)

      const actualizado: Donante = {
        ...original,
        nombres: 'Ana Lucía',
        correo: `actualizado.${randomUUID().slice(0, 8)}@proinserco.test`,
        celular: '+573119876543',
        quiereCertificado: true,
        actualizadoEn: tActualizacion,
      }
      await donantes.guardar(actualizado)

      expect(await enContextoPanel(() => donantes.contar())).toBe(conteoInicial + 1)

      const leido = await enContextoPanel(() => donantes.buscarPorId(original.id))
      expect(leido).toEqual(actualizado)
    })

    it('buscarPorId y buscarPorDocumento encuentran existentes y retornan null para inexistentes o no-UUID', async () => {
      const { donantes, enContextoPanel } = await crearContexto()
      const donante = crearDonantePrueba({ tipoDocumento: 'CE' })
      await donantes.guardar(donante)

      const porId = await enContextoPanel(() => donantes.buscarPorId(donante.id))
      expect(porId?.id).toBe(donante.id)
      expect(porId?.correo).toBe(donante.correo)

      const porDoc = await donantes.buscarPorDocumento('CE', donante.numeroDocumento)
      expect(porDoc?.id).toBe(donante.id)

      expect(await enContextoPanel(() => donantes.buscarPorId(randomUUID()))).toBeNull()
      expect(await enContextoPanel(() => donantes.buscarPorId('no-es-uuid'))).toBeNull()
      expect(await donantes.buscarPorDocumento('CC', `INEXISTENTE-${randomUUID().slice(0, 8)}`)).toBeNull()
      expect(await donantes.buscarPorDocumento('PA', donante.numeroDocumento)).toBeNull()
    })

    it('listar filtra por q (nombre, apellido, correo y comodines escapados), pagina por cursor sin duplicados y maneja cursores inválidos', async () => {
      const { donantes, enContextoPanel } = await crearContexto()
      const tag = randomUUID().slice(0, 8)
      const t0 = new Date('2026-11-10T10:00:00.000Z')
      const t1 = new Date('2026-11-11T10:00:00.000Z')
      const t2 = new Date('2026-11-12T10:00:00.000Z')
      const t3 = new Date('2026-11-13T10:00:00.000Z')

      const d1 = crearDonantePrueba({
        nombres: 'Valeria',
        apellidos: 'Gómez',
        correo: `valeria_vip+${tag}@proinserco.test`,
        creadoEn: t0,
        actualizadoEn: t0,
      })
      const d2 = crearDonantePrueba({
        nombres: 'Mateo',
        apellidos: 'Rojas',
        correo: `mateo+${tag}@proinserco.test`,
        creadoEn: t1,
        actualizadoEn: t1,
      })
      const d3 = crearDonantePrueba({
        nombres: 'Camila',
        apellidos: 'Pérez',
        correo: `camila+${tag}@proinserco.test`,
        creadoEn: t2,
        actualizadoEn: t2,
      })
      const d4 = crearDonantePrueba({
        nombres: 'Julián',
        apellidos: 'Castro',
        correo: `julian+${tag}@proinserco.test`,
        creadoEn: t2,
        actualizadoEn: t2,
      })
      const d5 = crearDonantePrueba({
        nombres: `Sofía ${tag}`,
        apellidos: 'Ortega',
        correo: `sofia.ortega.${randomUUID().slice(0, 6)}@proinserco.test`,
        creadoEn: t3,
        actualizadoEn: t3,
      })

      for (const d of [d1, d2, d3, d4, d5]) {
        await donantes.guardar(d)
      }

      // Búsqueda por nombre, apellido y correo con `_` literal
      const porNombre = await enContextoPanel(() => donantes.listar({ q: `SOFÍA ${tag}` }, { limite: 10 }))
      expect(porNombre.total).toBe(1)
      expect(porNombre.elementos[0]?.id).toBe(d5.id)

      const porLiteral = await enContextoPanel(() => donantes.listar({ q: `VALERIA_VIP+${tag}` }, { limite: 10 }))
      expect(porLiteral.total).toBe(1)
      expect(porLiteral.elementos[0]?.id).toBe(d1.id)

      const porComodinNoLiteral = await enContextoPanel(() => donantes.listar({ q: `valeria%vip+${tag}` }, { limite: 10 }))
      expect(porComodinNoLiteral.total).toBe(0)

      // Paginación completa con cursor (incluyendo empate en t2)
      const recolectados: Donante[] = []
      let cursor: string | undefined
      for (let paso = 0; paso < 5; paso++) {
        const pagina = await enContextoPanel(() => donantes.listar({ q: tag }, { limite: 2, ...(cursor ? { cursor } : {}) }))
        expect(pagina.total).toBe(5)
        recolectados.push(...pagina.elementos)
        if (!pagina.cursorSiguiente) {
          cursor = undefined
          break
        }
        cursor = pagina.cursorSiguiente
      }

      expect(cursor).toBeUndefined()
      expect(recolectados).toHaveLength(5)
      expect(new Set(recolectados.map((d) => d.id))).toEqual(new Set([d1.id, d2.id, d3.id, d4.id, d5.id]))

      // Orden descendente por (creadoEn, id)
      for (let i = 1; i < recolectados.length; i++) {
        const prev = recolectados[i - 1]
        const curr = recolectados[i]
        expect(prev).toBeDefined()
        expect(curr).toBeDefined()
        if (!prev || !curr) continue
        expect(prev.creadoEn.getTime()).toBeGreaterThanOrEqual(curr.creadoEn.getTime())
        if (prev.creadoEn.getTime() === curr.creadoEn.getTime()) {
          expect(prev.id > curr.id).toBe(true)
        }
      }

      // Cursor manipulado o inválido reinicia de forma segura
      const primeraPagina = await enContextoPanel(() => donantes.listar({ q: tag }, { limite: 2 }))
      for (const invalido of [
        'cursor-roto!!',
        Buffer.from('{malformed').toString('base64url'),
        Buffer.from('{"en":"sin-id"}').toString('base64url'),
      ]) {
        const reinicio = await enContextoPanel(() => donantes.listar({ q: tag }, { limite: 2, cursor: invalido }))
        expect(reinicio.elementos.map((d) => d.id)).toEqual(primeraPagina.elementos.map((d) => d.id))
      }

      // Listado sin filtros pagina correctamente
      const sinFiltroP1 = await enContextoPanel(() => donantes.listar({}, { limite: 2 }))
      expect(sinFiltroP1.total).toBeGreaterThanOrEqual(5)
      expect(sinFiltroP1.elementos).toHaveLength(2)
      expect(sinFiltroP1.cursorSiguiente).not.toBeNull()
      const sinFiltroP2 = await enContextoPanel(() =>
        donantes.listar({}, { limite: 2, cursor: sinFiltroP1.cursorSiguiente ?? undefined }),
      )
      const idsP1 = new Set(sinFiltroP1.elementos.map((d) => d.id))
      for (const e of sinFiltroP2.elementos) {
        expect(idsP1.has(e.id)).toBe(false)
      }
    })
  })

  describe('contrato de RegistroConsentimientos', () => {
    it('insertar soporta ip desconocida, null, IPv6 y revocación otorgada=false; listarPorDonante preserva orden cronológico y finalidades', async () => {
      const { donantes, consentimientos, enContextoPanel } = await crearContexto()
      const donanteA = crearDonantePrueba()
      const donanteB = crearDonantePrueba()
      await donantes.guardar(donanteA)
      await donantes.guardar(donanteB)

      const t1 = new Date('2026-11-16T10:00:00.000Z')
      const t2 = new Date('2026-11-16T10:01:00.000Z')
      const t3 = new Date('2026-11-16T10:02:00.000Z')
      const t4 = new Date('2026-11-16T10:03:00.000Z')

      const entradas: Consentimiento[] = [
        {
          id: randomUUID(),
          donanteId: donanteA.id,
          correo: donanteA.correo,
          finalidad: 'gestion_donacion',
          versionTexto: 'politica-v1',
          otorgada: true,
          ip: '192.0.2.10',
          userAgent: 'vitest-ua',
          creadoEn: t1,
        },
        {
          id: randomUUID(),
          donanteId: donanteA.id,
          correo: donanteA.correo,
          finalidad: 'certificado_donacion',
          versionTexto: 'politica-v1',
          otorgada: true,
          ip: 'desconocida',
          userAgent: null,
          creadoEn: t2,
        },
        {
          id: randomUUID(),
          donanteId: donanteA.id,
          correo: donanteA.correo,
          finalidad: 'boletin',
          versionTexto: 'politica-v1',
          otorgada: true,
          ip: null,
          userAgent: 'vitest-ua',
          creadoEn: t3,
        },
        {
          id: randomUUID(),
          donanteId: donanteA.id,
          correo: donanteA.correo,
          finalidad: 'boletin',
          versionTexto: 'politica-v2',
          otorgada: false,
          ip: '2001:db8::1',
          userAgent: 'vitest-ua',
          creadoEn: t4,
        },
      ]

      for (const c of entradas) {
        await consentimientos.insertar(c)
      }

      // Otro donante aislado
      await consentimientos.insertar({
        id: randomUUID(),
        donanteId: donanteB.id,
        correo: donanteB.correo,
        finalidad: 'gestion_donacion',
        versionTexto: 'politica-v1',
        otorgada: true,
        ip: null,
        userAgent: null,
        creadoEn: t1,
      })

      const listaA = await enContextoPanel(() => consentimientos.listarPorDonante(donanteA.id))
      expect(listaA).toHaveLength(4)
      expect(listaA.map((c) => c.id)).toEqual(entradas.map((c) => c.id))
      expect(listaA.map((c) => c.finalidad)).toEqual([
        'gestion_donacion',
        'certificado_donacion',
        'boletin',
        'boletin',
      ] satisfies FinalidadConsentimiento[])
      expect(listaA.map((c) => c.otorgada)).toEqual([true, true, true, false])
      expect(listaA[0]?.ip).toBe('192.0.2.10')
      expect(listaA[1]?.ip === null || listaA[1]?.ip === 'desconocida').toBe(true)
      expect(listaA[2]?.ip).toBeNull()
      expect(listaA[3]?.ip).toBe('2001:db8::1')
      expect(listaA[3]?.versionTexto).toBe('politica-v2')

      const listaB = await enContextoPanel(() => consentimientos.listarPorDonante(donanteB.id))
      expect(listaB).toHaveLength(1)
      expect(listaB[0]?.donanteId).toBe(donanteB.id)

      expect(await enContextoPanel(() => consentimientos.listarPorDonante(randomUUID()))).toEqual([])
      expect(await enContextoPanel(() => consentimientos.listarPorDonante('no-es-uuid'))).toEqual([])
    })
  })
}
