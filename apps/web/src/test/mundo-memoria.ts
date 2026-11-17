import { crearListarAuditoria } from '@/modules/auditoria/application/use-cases/listar-auditoria'
import { crearRegistrarAuditoria } from '@/modules/auditoria/application/use-cases/registrar-auditoria'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import type { RegistroDeDonantes } from '@/modules/donaciones/application/ports/registro-de-donantes'
import { crearConciliarDonacion } from '@/modules/donaciones/application/use-cases/conciliar-donacion'
import { crearConsultarResultadoDonacion } from '@/modules/donaciones/application/use-cases/consultar-resultado-donacion'
import { type ConfiguracionDonaciones, crearCrearDonacion } from '@/modules/donaciones/application/use-cases/crear-donacion'
import { crearListarDonaciones } from '@/modules/donaciones/application/use-cases/listar-donaciones'
import { crearObtenerDonacion } from '@/modules/donaciones/application/use-cases/obtener-donacion'
import { crearObtenerIndicadores } from '@/modules/donaciones/application/use-cases/obtener-indicadores'
import { crearPasarelaSimulada } from '@/modules/donaciones/infrastructure/pasarela-simulada'
import { crearRepositorioDonacionesMemoria } from '@/modules/donaciones/infrastructure/repositorio-donaciones-memoria'
import { crearListarDonantes } from '@/modules/donantes/application/use-cases/listar-donantes'
import { crearObtenerDonante, crearRevelarDatoDonante } from '@/modules/donantes/application/use-cases/obtener-donante'
import { crearRegistrarConsentimiento } from '@/modules/donantes/application/use-cases/registrar-consentimiento'
import { crearRegistrarDonante } from '@/modules/donantes/application/use-cases/registrar-donante'
import {
  crearRegistroConsentimientosMemoria,
  crearRepositorioDonantesMemoria,
} from '@/modules/donantes/infrastructure/repositorios-memoria'
import { PERMISOS_POR_ROL, type Rol } from '@/modules/iam/domain/roles'
import type { Auditor } from '@/shared/application/ports/auditor'
import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import { Actor } from '@/shared/domain/actor'
import { crearPublicadorEventosMemoria } from '@/shared/infrastructure/publicador-eventos-memoria'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'

export const AHORA = new Date('2026-11-16T15:00:00.000Z')

/** Ids predecibles para los tests. */
export function crearIdsSecuenciales(): GeneradorIds {
  let n = 0
  const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  return {
    uuid: () => {
      n += 1
      return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
    },
    referencia: () => {
      n += 1
      let resto = n
      let simbolos = ''
      for (let i = 0; i < 21; i++) {
        simbolos = (ALFABETO[resto % 32] ?? '0') + simbolos
        resto = Math.floor(resto / 32)
      }
      return `DON-${simbolos}`
    },
  }
}

export function actorDe(rol: Rol, id = `usr_${rol}`): Actor {
  return new Actor(id, rol, `${rol}@demo.test`, rol, PERMISOS_POR_ROL[rol], 'aal2')
}

export const DONANTE_VALIDO = {
  nombres: 'Ana María',
  apellidos: 'Muñoz Ortega',
  tipoDocumento: 'CC',
  numeroDocumento: '1.061.000.111',
  correo: 'Ana.Munoz@Correo-Demo.test',
  celular: '300 123 4567',
} as const

/** Mundo completo con adaptadores en memoria, cableado como en el contenedor. */
export function crearMundoMemoria(configuracion: Partial<ConfiguracionDonaciones> = {}) {
  const reloj = crearRelojFijo(AHORA)
  const ids = crearIdsSecuenciales()
  const eventos = crearPublicadorEventosMemoria()
  const registroAuditoria = crearRegistroAuditoriaMemoria()
  const registrarAuditoria = crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids })
  const auditor: Auditor = { registrar: registrarAuditoria }

  const repoDonantes = crearRepositorioDonantesMemoria()
  const consentimientos = crearRegistroConsentimientosMemoria()
  const registrarConsentimiento = crearRegistrarConsentimiento({ consentimientos, reloj, ids, auditor })
  const registrarDonante = crearRegistrarDonante({
    donantes: repoDonantes,
    registrarConsentimiento,
    reloj,
    ids,
    versionPoliticaDatos: 'v-test',
  })
  const registroDeDonantes: RegistroDeDonantes = {
    async registrar(datos, quiereCertificado, ctx) {
      const d = await registrarDonante({ datos, quiereCertificado, ip: ctx.ip, userAgent: ctx.userAgent })
      return { donanteId: d.id, nombres: d.nombres, apellidos: d.apellidos, correo: d.correo }
    },
  }

  const repoDonaciones = crearRepositorioDonacionesMemoria()
  const pasarela = crearPasarelaSimulada({ ids, urlBase: 'https://proinserco.test' })
  const conciliarDonacion = crearConciliarDonacion({ donaciones: repoDonaciones, pasarela, reloj, eventos, auditor })
  const crearDonacion = crearCrearDonacion({
    donaciones: repoDonaciones,
    pasarela,
    donantes: registroDeDonantes,
    reloj,
    ids,
    eventos,
    auditor,
    configuracion: {
      limites: { minimoPesos: 10_000, maximoPesos: 20_000_000 },
      habilitadas: true,
      urlBase: 'https://proinserco.test',
      ...configuracion,
    },
  })
  const fallos: unknown[] = []

  return {
    reloj,
    eventos,
    pasarela,
    repoDonaciones,
    repoDonantes,
    consentimientos,
    registroAuditoria,
    crearDonacion,
    conciliarDonacion,
    consultarResultado: crearConsultarResultadoDonacion({
      donaciones: repoDonaciones,
      conciliar: conciliarDonacion,
      registrarFallo: (e) => fallos.push(e),
    }),
    fallos,
    listarDonaciones: crearListarDonaciones({ donaciones: repoDonaciones }),
    obtenerDonacion: crearObtenerDonacion({ donaciones: repoDonaciones }),
    obtenerIndicadores: crearObtenerIndicadores({ donaciones: repoDonaciones, reloj }),
    listarDonantes: crearListarDonantes({ donantes: repoDonantes }),
    obtenerDonante: crearObtenerDonante({ donantes: repoDonantes, consentimientos, auditor }),
    revelarDatoDonante: crearRevelarDatoDonante({ donantes: repoDonantes, consentimientos, auditor }),
    registrarConsentimiento,
    listarAuditoria: crearListarAuditoria({ registro: registroAuditoria }),
    registrarAuditoria,
  }
}

let contadorClave = 0
/** Solicitud de donación válida; `montoPesos` y la clave se pueden variar. */
export function solicitudDonacion(montoPesos = 50_000, claveIdempotencia?: string) {
  contadorClave += 1
  return {
    donacion: {
      montoPesos,
      linea: 'educacion',
      claveIdempotencia: claveIdempotencia ?? `11111111-1111-4111-8111-${String(contadorClave).padStart(12, '0')}`,
    },
    donante: DONANTE_VALIDO,
    quiereCertificado: true,
    contexto: { ip: '192.0.2.10', userAgent: 'vitest' },
  }
}
