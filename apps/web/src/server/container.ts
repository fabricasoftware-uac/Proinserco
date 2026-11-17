import 'server-only'
import { crearListarAuditoria } from '@/modules/auditoria/application/use-cases/listar-auditoria'
import { crearRegistrarAuditoria } from '@/modules/auditoria/application/use-cases/registrar-auditoria'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import { crearRegistroAuditoriaPostgres } from '@/modules/auditoria/infrastructure/registro-auditoria-postgres'
import { sembrarAuditoria } from '@/modules/auditoria/infrastructure/semilla-auditoria'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import type { RegistroDeDonantes } from '@/modules/donaciones/application/ports/registro-de-donantes'
import { crearConciliarDonacion } from '@/modules/donaciones/application/use-cases/conciliar-donacion'
import { crearConsultarResultadoDonacion } from '@/modules/donaciones/application/use-cases/consultar-resultado-donacion'
import { crearCrearDonacion } from '@/modules/donaciones/application/use-cases/crear-donacion'
import { crearListarDonaciones } from '@/modules/donaciones/application/use-cases/listar-donaciones'
import { crearObtenerDonacion } from '@/modules/donaciones/application/use-cases/obtener-donacion'
import { crearObtenerIndicadores } from '@/modules/donaciones/application/use-cases/obtener-indicadores'
import { crearPasarelaOpenpay } from '@/modules/donaciones/infrastructure/pasarela-openpay'
import { crearPasarelaSimulada, type PasarelaSimulada } from '@/modules/donaciones/infrastructure/pasarela-simulada'
import { crearRepositorioDonacionesMemoria } from '@/modules/donaciones/infrastructure/repositorio-donaciones-memoria'
import { crearRepositorioDonacionesPostgres } from '@/modules/donaciones/infrastructure/repositorio-donaciones-postgres'
import { sembrarDonaciones } from '@/modules/donaciones/infrastructure/semilla-donaciones'
import { crearContarDonantes, crearListarDonantes } from '@/modules/donantes/application/use-cases/listar-donantes'
import { crearObtenerDonante, crearRevelarDatoDonante } from '@/modules/donantes/application/use-cases/obtener-donante'
import { crearRegistrarConsentimiento } from '@/modules/donantes/application/use-cases/registrar-consentimiento'
import { crearRegistrarDonante } from '@/modules/donantes/application/use-cases/registrar-donante'
import {
  crearRegistroConsentimientosMemoria,
  crearRepositorioDonantesMemoria,
} from '@/modules/donantes/infrastructure/repositorios-memoria'
import {
  crearRegistroConsentimientosPostgres,
  crearRepositorioDonantesPostgres,
} from '@/modules/donantes/infrastructure/repositorios-postgres'
import { sembrarDonantes } from '@/modules/donantes/infrastructure/semilla-donantes'
import { crearCerrarSesion } from '@/modules/iam/application/use-cases/cerrar-sesion'
import { crearIniciarSesion } from '@/modules/iam/application/use-cases/iniciar-sesion'
import { crearObtenerActor } from '@/modules/iam/application/use-cases/obtener-actor'
import { crearVerificarSegundoFactor } from '@/modules/iam/application/use-cases/verificar-segundo-factor'
import { crearIdentityProviderMemoria } from '@/modules/iam/infrastructure/identity-provider-memoria'
import { crearIdentityProviderSupabase } from '@/modules/iam/infrastructure/identity-provider-supabase'
import { USUARIOS_DEMO } from '@/modules/iam/infrastructure/usuarios-demo'
import type { Auditor } from '@/shared/application/ports/auditor'
import { crearAleatorioDeterminista } from '@/shared/infrastructure/aleatorio-determinista'
import { crearGeneradorIdsCripto } from '@/shared/infrastructure/generador-ids-cripto'
import { crearLimitadorMemoria } from '@/shared/infrastructure/limitador-memoria'
import { crearLimitadorRedis } from '@/shared/infrastructure/limitador-redis'
import { crearPublicadorEventosMemoria } from '@/shared/infrastructure/publicador-eventos-memoria'
import { crearRelojSistema } from '@/shared/infrastructure/reloj'
import { crearVerificadorAntiBotsMemoria } from '@/shared/infrastructure/verificador-anti-bots-memoria'
import { crearVerificadorTurnstile } from '@/shared/infrastructure/verificador-turnstile'
import { type Env, obtenerEnv } from './env'
import { nombresCookies } from './nombres-cookies'
import { registro } from './registro'

/**
 * COMPOSITION ROOT — el ÚNICO sitio donde `application` e `infrastructure`
 * se encuentran. `ADAPTADORES=memoria|real` decide qué implementa cada puerto.
 * Cambiar un adaptador = tocar este archivo, nunca un caso de uso.
 */
function crearContenedor(env: Env) {
  const esMemoria = env.ADAPTADORES === 'memoria'
  const reloj = crearRelojSistema()
  const ids = crearGeneradorIdsCripto()
  const eventos = crearPublicadorEventosMemoria((error, evento) =>
    registro.error('Fallo en un suscriptor de eventos', { error, tipo: evento.tipo }),
  )
  const limitador = env.LIMITADOR_URL ? crearLimitadorRedis(env.LIMITADOR_URL) : crearLimitadorMemoria(reloj)
  const verificadorAntiBots =
    env.antibots === 'turnstile' && env.TURNSTILE_SECRET_KEY
      ? crearVerificadorTurnstile({
          secreto: env.TURNSTILE_SECRET_KEY,
          hostnameEsperado: env.hostname,
          alFallar: (motivo) => registro.advertencia('Turnstile no respondió', { motivo }),
        })
      : crearVerificadorAntiBotsMemoria()

  // ─── auditoria ───
  const registroAuditoria = esMemoria ? crearRegistroAuditoriaMemoria() : crearRegistroAuditoriaPostgres()
  const registrarAuditoria = crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids })
  const auditor: Auditor = { registrar: registrarAuditoria }

  // ─── donantes ───
  const repoDonantes = esMemoria ? crearRepositorioDonantesMemoria() : crearRepositorioDonantesPostgres()
  const consentimientos = esMemoria ? crearRegistroConsentimientosMemoria() : crearRegistroConsentimientosPostgres()
  const registrarConsentimiento = crearRegistrarConsentimiento({ consentimientos, reloj, ids, auditor })
  const registrarDonante = crearRegistrarDonante({
    donantes: repoDonantes,
    registrarConsentimiento,
    reloj,
    ids,
    versionPoliticaDatos: CONTENIDO_SITIO.legal.versionPoliticaDatos,
  })

  // ─── donaciones ───
  const repoDonaciones = esMemoria ? crearRepositorioDonacionesMemoria() : crearRepositorioDonacionesPostgres()
  const pasarelaSimulada: PasarelaSimulada | null = esMemoria ? crearPasarelaSimulada({ ids, urlBase: env.APP_URL }) : null
  const pasarela =
    pasarelaSimulada ??
    crearPasarelaOpenpay({
      merchantId: env.OPENPAY_MERCHANT_ID ?? '',
      llavePrivada: env.OPENPAY_PRIVATE_KEY ?? '',
      urlApi: env.OPENPAY_API_URL ?? '',
    })
  // Puerto propio de donaciones → caso de uso de donantes (los módulos no se importan entre sí).
  const registroDeDonantes: RegistroDeDonantes = {
    async registrar(datos, quiereCertificado, contexto) {
      const d = await registrarDonante({ datos, quiereCertificado, ip: contexto.ip, userAgent: contexto.userAgent })
      return { donanteId: d.id, nombres: d.nombres, apellidos: d.apellidos, correo: d.correo }
    },
  }
  const conciliarDonacion = crearConciliarDonacion({ donaciones: repoDonaciones, pasarela, reloj, eventos, auditor })

  // ─── iam ───
  const cookies = nombresCookies(env.esHttps)
  const identidad = esMemoria
    ? crearIdentityProviderMemoria(USUARIOS_DEMO, reloj, {
        secreto: env.SESION_SECRETO,
        cookiesSeguras: env.esHttps,
        nombreCookieSesion: cookies.sesion,
        nombreCookieDesafio: cookies.desafioMfa,
        inactividadMinutos: 30,
        duracionMaximaHoras: 8,
      })
    : crearIdentityProviderSupabase({ url: env.SUPABASE_URL ?? '', claveAnonima: env.SUPABASE_ANON_KEY ?? '' })

  const contenedor = {
    modo: env.ADAPTADORES,
    transversal: { reloj, limitador, verificadorAntiBots, auditor },
    donaciones: {
      crearDonacion: crearCrearDonacion({
        donaciones: repoDonaciones,
        pasarela,
        donantes: registroDeDonantes,
        reloj,
        ids,
        eventos,
        auditor,
        configuracion: {
          limites: { minimoPesos: env.DONACION_MONTO_MINIMO_COP, maximoPesos: env.DONACION_MONTO_MAXIMO_COP },
          habilitadas: env.DONACIONES_HABILITADAS === 'si',
          urlBase: env.APP_URL,
        },
      }),
      conciliarDonacion,
      consultarResultado: crearConsultarResultadoDonacion({
        donaciones: repoDonaciones,
        conciliar: conciliarDonacion,
        registrarFallo: (error) => registro.error('Conciliación fallida en la página de resultado', { error }),
      }),
      listarDonaciones: crearListarDonaciones({ donaciones: repoDonaciones }),
      obtenerDonacion: crearObtenerDonacion({ donaciones: repoDonaciones }),
      obtenerIndicadores: crearObtenerIndicadores({ donaciones: repoDonaciones, reloj }),
      limites: { minimoPesos: env.DONACION_MONTO_MINIMO_COP, maximoPesos: env.DONACION_MONTO_MAXIMO_COP },
    },
    donantes: {
      listarDonantes: crearListarDonantes({ donantes: repoDonantes }),
      contarDonantes: crearContarDonantes({ donantes: repoDonantes }),
      obtenerDonante: crearObtenerDonante({ donantes: repoDonantes, consentimientos, auditor }),
      revelarDatoDonante: crearRevelarDatoDonante({ donantes: repoDonantes, consentimientos, auditor }),
      registrarConsentimiento,
    },
    iam: {
      iniciarSesion: crearIniciarSesion({ identidad, auditor }),
      verificarSegundoFactor: crearVerificarSegundoFactor({ identidad, auditor }),
      cerrarSesion: crearCerrarSesion({ identidad, auditor }),
      obtenerActor: crearObtenerActor({ identidad }),
      desafioPendiente: identidad.desafioPendiente,
    },
    auditoria: {
      registrarAuditoria,
      listarAuditoria: crearListarAuditoria({ registro: registroAuditoria }),
    },
    /** Solo con ADAPTADORES=memoria: la pasarela de pruebas interna. */
    pasarelaSimulada,
  }

  const semilla = esMemoria
    ? sembrar({ repoDonantes, consentimientos, repoDonaciones, pasarelaSimulada, registroAuditoria, ahora: reloj.ahora() })
    : Promise.resolve()
  return { contenedor, semilla }
}

/** Datos de DEMOSTRACIÓN (ficticios). Solo con adaptadores en memoria. */
async function sembrar(d: {
  repoDonantes: ReturnType<typeof crearRepositorioDonantesMemoria>
  consentimientos: ReturnType<typeof crearRegistroConsentimientosMemoria>
  repoDonaciones: ReturnType<typeof crearRepositorioDonacionesMemoria>
  pasarelaSimulada: PasarelaSimulada | null
  registroAuditoria: ReturnType<typeof crearRegistroAuditoriaMemoria>
  ahora: Date
}) {
  if (!d.pasarelaSimulada) return
  const aleatorio = crearAleatorioDeterminista(20_261_116)
  const donantes = await sembrarDonantes({
    repositorio: d.repoDonantes,
    consentimientos: d.consentimientos,
    aleatorio,
    ahora: d.ahora,
  })
  await sembrarDonaciones({ repositorio: d.repoDonaciones, pasarela: d.pasarelaSimulada, donantes, aleatorio, ahora: d.ahora })
  await sembrarAuditoria({ registro: d.registroAuditoria, aleatorio, ahora: d.ahora, usuarios: USUARIOS_DEMO.map((u) => u.id) })
}

export type Contenedor = ReturnType<typeof crearContenedor>['contenedor']

// En memoria el estado debe sobrevivir entre peticiones del mismo proceso
// (y a la recarga en caliente de `next dev`): se guarda en globalThis.
const CLAVE_GLOBAL = Symbol.for('proinserco.contenedor')
type ConContenedor = typeof globalThis & { [CLAVE_GLOBAL]?: Promise<Contenedor> }

/** Punto de entrada para páginas, acciones y route handlers. */
export function obtenerContenedor(): Promise<Contenedor> {
  const global = globalThis as ConContenedor
  global[CLAVE_GLOBAL] ??= (async () => {
    const env = obtenerEnv()
    const { contenedor, semilla } = crearContenedor(env)
    await semilla
    if (env.ADAPTADORES === 'memoria') {
      registro.advertencia('Adaptadores EN MEMORIA: usuarios demo, pasarela simulada y datos ficticios')
    }
    if (env.ADAPTADORES === 'real' && !env.LIMITADOR_URL) {
      registro.advertencia('Limitador de tasa en memoria: válido solo con UNA instancia de la app')
    }
    return contenedor
  })().catch((error: unknown) => {
    delete global[CLAVE_GLOBAL]
    throw error
  })
  return global[CLAVE_GLOBAL]
}
