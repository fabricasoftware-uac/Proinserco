import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import type { LimitadorDeTasa, ResultadoLimite } from '../application/ports/limitador-de-tasa'

const TIMEOUT_MS = 200
const PREFIJO_REDIS = 'ratelimit:'
const MARCADOR_IDENTIDAD = ':id:'
const PREFIJOS_FALLO_ABIERTO = ['webhook-openpay:'] as const

const SCRIPT_VENTANA_FIJA = `
local cuenta = redis.call('INCR', KEYS[1])
local ventana = tonumber(ARGV[1])
if cuenta == 1 then
  redis.call('EXPIRE', KEYS[1], ventana)
  return { cuenta, ventana }
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ventana)
  ttl = ventana
end
return { cuenta, ttl }
`.trim()

export type OpcionesLimitadorRedis = Readonly<{
  alFallar?: (error: unknown, clave: string) => void
}>

function sanitizarClave(clave: string): string {
  const indice = clave.indexOf(MARCADOR_IDENTIDAD)
  if (indice === -1) return clave
  const inicioValor = indice + MARCADOR_IDENTIDAD.length
  const valor = clave.slice(inicioValor)
  if (!valor) return clave
  const hash = createHash('sha256').update(valor).digest('hex')
  return `${clave.slice(0, inicioValor)}${hash}`
}

function permiteFalloAbierto(claveSegura: string): boolean {
  return PREFIJOS_FALLO_ABIERTO.some((prefijo) => claveSegura.startsWith(prefijo))
}

function esperarConexionInicial(cliente: Redis): Promise<void> {
  const estado = cliente.status
  if (estado !== 'wait' && estado !== 'connecting' && estado !== 'connect') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    let finalizado = false
    const limpiar = () => {
      clearTimeout(temporizador)
      cliente.off('ready', alEstarListo)
      cliente.off('error', alFallar)
      cliente.off('close', alCerrar)
      cliente.off('end', alTerminar)
    }
    const concluir = (fn: () => void) => {
      if (finalizado) return
      finalizado = true
      limpiar()
      fn()
    }
    const alEstarListo = () => concluir(resolve)
    const alFallar = (error: Error) => concluir(() => reject(error))
    const alCerrar = () => concluir(() => reject(new Error('Conexión Redis cerrada antes de estar lista')))
    const alTerminar = () => concluir(() => reject(new Error('Conexión Redis finalizada')))

    const temporizador = setTimeout(() => {
      concluir(() => reject(new Error('Tiempo de espera de conexión a Redis agotado')))
    }, TIMEOUT_MS)
    temporizador.unref?.()

    cliente.once('ready', alEstarListo)
    cliente.once('error', alFallar)
    cliente.once('close', alCerrar)
    cliente.once('end', alTerminar)

    if (estado === 'wait') {
      cliente.connect().catch((error: unknown) => {
        concluir(() => reject(error instanceof Error ? error : new Error(String(error))))
      })
    }
  })
}

function analizarRespuestaLua(respuesta: unknown, ventana: number): { cuenta: number; ttl: number } {
  if (!Array.isArray(respuesta) || respuesta.length < 2) {
    throw new Error('Respuesta inesperada del script Lua de límite de tasa')
  }
  const cuenta = Number(respuesta[0])
  const ttlCrudo = Number(respuesta[1])
  if (!Number.isFinite(cuenta) || cuenta < 1) {
    throw new Error('Contador inválido devuelto por Redis')
  }
  const ttl = Number.isFinite(ttlCrudo) && ttlCrudo > 0 ? Math.ceil(ttlCrudo) : ventana
  return { cuenta, ttl }
}

/**
 * Limitador de tasa con ventana fija sobre Redis (`ioredis`) y script Lua atómico.
 * Falla cerrado por defecto (incluidas rutas críticas de login, MFA, donaciones,
 * exportación y revelado); solo permite fallo abierto en rutas de respaldo como
 * `webhook-openpay:`.
 */
export function crearLimitadorRedis(url: string, opciones?: OpcionesLimitadorRedis): LimitadorDeTasa {
  const cliente = new Redis(url, {
    connectTimeout: TIMEOUT_MS,
    commandTimeout: TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  })
  cliente.on('error', () => {
    // Los errores por petición se manejan en `consumir()` para aplicar la política de fallo.
  })

  return {
    async consumir(clave, limite, ventanaSegundos): Promise<ResultadoLimite> {
      const ventana = Math.max(1, Math.ceil(ventanaSegundos))
      const limiteSeguro = Math.max(0, Math.floor(limite))
      const claveSegura = sanitizarClave(clave)
      const claveRedis = `${PREFIJO_REDIS}${claveSegura}`

      try {
        await esperarConexionInicial(cliente)
        const respuesta = await cliente.eval(SCRIPT_VENTANA_FIJA, 1, claveRedis, String(ventana))
        const { cuenta, ttl } = analizarRespuestaLua(respuesta, ventana)
        const permitido = cuenta <= limiteSeguro
        return {
          permitido,
          restantes: Math.max(0, limiteSeguro - cuenta),
          reintentarEnSegundos: permitido ? 0 : ttl,
        }
      } catch (error) {
        opciones?.alFallar?.(error, claveSegura)
        if (permiteFalloAbierto(claveSegura)) {
          return { permitido: true, restantes: limiteSeguro, reintentarEnSegundos: 0 }
        }
        return { permitido: false, restantes: 0, reintentarEnSegundos: ventana }
      }
    },
  }
}
