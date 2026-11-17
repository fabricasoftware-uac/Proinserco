import { describe, expect, it } from 'vitest'
import { Actor } from '@/shared/domain/actor'
import { NoAutorizado } from '@/shared/domain/errores'
import { actorDe, crearMundoMemoria, solicitudDonacion } from '@/test/mundo-memoria'
import { AutorizacionDatos } from '../../domain/consentimiento'
import { DatosDonante } from '../../domain/donante'

describe('datos del donante', () => {
  it('normaliza correo, documento y celular', () => {
    const d = DatosDonante.parse({
      nombres: 'Luz Dary',
      apellidos: 'Paz',
      tipoDocumento: 'CC',
      numeroDocumento: ' 34.567.890 ',
      correo: 'LUZ@Ejemplo.TEST',
      celular: '+57 (310) 555-1234',
    })
    expect(d).toMatchObject({ numeroDocumento: '34567890', correo: 'luz@ejemplo.test', celular: '+573105551234' })
  })

  it('rechaza campos extra (mass assignment) y textos sin tope', () => {
    const base = {
      nombres: 'A b',
      apellidos: 'C d',
      tipoDocumento: 'CC',
      numeroDocumento: '1234',
      correo: 'a@b.test',
      celular: '3001234567',
    }
    expect(DatosDonante.safeParse({ ...base, rol: 'admin' }).success).toBe(false)
    expect(DatosDonante.safeParse({ ...base, nombres: 'x'.repeat(81) }).success).toBe(false)
    expect(DatosDonante.safeParse({ ...base, celular: '6012345678' }).success).toBe(false)
  })

  it('la autorización de datos solo vale si es true (casilla no premarcada)', () => {
    expect(AutorizacionDatos.safeParse(true).success).toBe(true)
    expect(AutorizacionDatos.safeParse(false).success).toBe(false)
    expect(AutorizacionDatos.safeParse(undefined).success).toBe(false)
    expect(AutorizacionDatos.safeParse('on').success).toBe(false)
  })
})

describe('casos de uso de donantes', () => {
  it('un donante que repite documento se actualiza, no se duplica', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    await m.crearDonacion(solicitudDonacion())
    expect((await m.listarDonantes({}, {}, actorDe('consulta'))).total).toBe(1)
  })

  it('busca por nombre o correo', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    const admin = actorDe('administrador')
    expect((await m.listarDonantes({ q: 'muñoz' }, {}, admin)).total).toBe(1)
    expect((await m.listarDonantes({ q: 'nadie' }, {}, admin)).total).toBe(0)
  })

  it('revelar un dato exige permiso propio y queda auditado sin el valor', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    const [donante] = (await m.listarDonantes({}, {}, actorDe('administrador'))).elementos
    const id = donante?.id ?? ''
    await expect(m.revelarDatoDonante(id, 'correo', actorDe('consulta'), null)).rejects.toThrow(NoAutorizado)
    expect(await m.revelarDatoDonante(id, 'correo', actorDe('administrador'), '192.0.2.1')).toBe('ana.munoz@correo-demo.test')
    const auditoria = await m.listarAuditoria({ accion: 'donante.dato_revelado' }, {}, actorDe('administrador'))
    expect(auditoria.total).toBe(1)
    expect(JSON.stringify(auditoria.elementos)).not.toContain('ana.munoz')
  })

  it('el detalle trae las autorizaciones registradas', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    const [donante] = (await m.listarDonantes({}, {}, actorDe('administrador'))).elementos
    const { consentimientos } = await m.obtenerDonante(donante?.id ?? '', actorDe('consulta'))
    expect(consentimientos.every((c) => c.otorgada && c.versionTexto === 'v-test')).toBe(true)
  })

  it('una revocación es una fila nueva', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    const [donante] = (await m.listarDonantes({}, {}, actorDe('administrador'))).elementos
    await m.registrarConsentimiento({
      donanteId: donante?.id ?? '',
      correo: donante?.correo ?? '',
      finalidad: 'certificado_donacion',
      versionTexto: 'v-test',
      otorgada: false,
      ip: null,
      userAgent: null,
    })
    expect(await m.consentimientos.listarPorDonante(donante?.id ?? '')).toHaveLength(3)
  })

  it('sin permiso de lectura no se lista', async () => {
    const m = crearMundoMemoria()
    await expect(m.listarDonantes({}, {}, new Actor('x', 'x', 'x@x.test', 'x', [], 'aal2'))).rejects.toThrow(NoAutorizado)
  })
})
