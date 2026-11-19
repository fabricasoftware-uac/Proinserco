import 'server-only'
import { randomUUID } from 'node:crypto'
import { createMiddleware, createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import type { Actor, Permiso } from '@/shared/domain/actor'
import {
  DemasiadasPeticiones,
  ErrorDeDominio,
  NoAutenticado,
  NoAutorizado,
  NoEncontrado,
  VerificacionAntiBotsFallida,
} from '@/shared/domain/errores'
import { obtenerActor } from './auth-context'
import { obtenerContenedor } from './container'
import { contextoPeticion } from './contexto-peticion'
import { ejecutarConContextoDb } from './db/contexto-db'
import { registro } from './registro'

/**
 * Clientes de next-safe-action. TODA server action del proyecto nace de aquí.
 *
 *   accionPublica                       → sitio público (sin sesión)
 *     .use(conLimiteDeTasa(…))          → limitador ANTES de cualquier trabajo caro
 *     .use(conAntiBots)                 → Turnstile verificado en servidor
 *     .inputSchema(Esquema)             → validación Zod (mismo esquema que el cliente)
 *     .action(…)
 *
 *   accionPanel                         → exige actor aal2 (sesión + MFA), revalidado en cada llamada
 *     .use(conPermiso('donantes:revelar'))
 *     .inputSchema(…).action(({ parsedInput, ctx: { actor } }) => …)
 *
 * Los errores salen como { codigo, mensaje, requestId } sin detalles internos.
 */

/** Forma ÚNICA del error que recibe el cliente. */
export type ErrorAccion = Readonly<{
  codigo: string
  mensaje: string
  requestId: string
  reintentarEnSegundos?: number
}>

const Metadatos = z.object({ nombre: z.string().min(1).max(60) })
type Metadatos = z.infer<typeof Metadatos>

const MENSAJE_GENERICO = 'Ha ocurrido un error. Inténtalo de nuevo'

function aErrorAccion(error: Error, metadatos: Metadatos | undefined): ErrorAccion {
  const requestId = randomUUID()
  // Sin permiso se responde igual que "no existe": no se confirma la existencia del recurso.
  if (error instanceof NoAutorizado || error instanceof NoEncontrado) {
    registro.advertencia('Acción denegada o recurso inexistente', {
      requestId,
      accion: metadatos?.nombre,
      codigo: (error as ErrorDeDominio).code,
    })
    return { codigo: 'NO_ENCONTRADO', mensaje: new NoEncontrado().message, requestId }
  }
  if (error instanceof ErrorDeDominio && error.esPublico) {
    registro.info('Acción rechazada', { requestId, accion: metadatos?.nombre, codigo: error.code })
    return error instanceof DemasiadasPeticiones
      ? { codigo: error.code, mensaje: error.message, requestId, reintentarEnSegundos: error.reintentarEnSegundos }
      : { codigo: error.code, mensaje: error.message, requestId }
  }
  if (error instanceof z.ZodError) {
    return { codigo: 'VALIDACION_FALLIDA', mensaje: 'Revisa los datos enviados', requestId }
  }
  registro.error('Error no controlado en una server action', { requestId, accion: metadatos?.nombre, error, causa: error.cause })
  return { codigo: 'ERROR_INTERNO', mensaje: MENSAJE_GENERICO, requestId }
}

/** Cliente base: metadatos obligatorios (nombre de la acción para logs y límites). */
export const accionPublica = createSafeActionClient({
  defineMetadataSchema: () => Metadatos,
  handleServerError: (error, utils): ErrorAccion => aErrorAccion(error, utils.metadata),
  defaultValidationErrorsShape: 'formatted',
})

type Base = { serverError: ErrorAccion; metadata: Metadatos }

/**
 * Limitador de tasa por IP (y opcionalmente por una identidad sacada de la
 * entrada sin validar, p. ej. el correo). Va el PRIMERO: es la puerta más barata.
 */
export function conLimiteDeTasa(opciones: {
  limite: number
  ventanaSegundos: number
  /** Segunda clave (por identidad). Recibe la entrada SIN validar: tratarla como no confiable. */
  identidad?: (entrada: unknown) => string | null
  limiteIdentidad?: number
  /** La clave por identidad combina identidad + IP (un tercero no puede agotar el cupo de una cuenta). */
  identidadConIp?: boolean
}) {
  return createMiddleware<Base>().define(async ({ next, metadata, clientInput }) => {
    const { limitador } = (await obtenerContenedor()).transversal
    const { ip } = await contextoPeticion()
    const porIp = await limitador.consumir(`${metadata.nombre}:ip:${ip}`, opciones.limite, opciones.ventanaSegundos)
    if (!porIp.permitido) throw new DemasiadasPeticiones(porIp.reintentarEnSegundos)
    const identidad = opciones.identidad?.(clientInput)
    if (identidad) {
      const valor = identidad.toLowerCase().slice(0, 254)
      const clave = `${metadata.nombre}:id:${opciones.identidadConIp ? `${valor}|${ip}` : valor}`
      const porId = await limitador.consumir(clave, opciones.limiteIdentidad ?? opciones.limite, opciones.ventanaSegundos)
      if (!porId.permitido) throw new DemasiadasPeticiones(porId.reintentarEnSegundos)
    }
    return next()
  })
}

const ConTokenAntiBots = z.object({ tokenAntiBots: z.string().min(1).max(2048) })

/**
 * Verificación anti-bots (Turnstile) en servidor, ANTES de validar y de
 * tocar la pasarela. La entrada debe traer `tokenAntiBots`. Falla cerrado.
 */
export const conAntiBots = createMiddleware<Base>().define(async ({ next, clientInput }) => {
  const token = ConTokenAntiBots.safeParse(clientInput)
  if (!token.success) throw new VerificacionAntiBotsFallida()
  const { verificadorAntiBots } = (await obtenerContenedor()).transversal
  const { ip } = await contextoPeticion()
  if (!(await verificadorAntiBots.verificar(token.data.tokenAntiBots, ip))) throw new VerificacionAntiBotsFallida()
  return next()
})

/** Cliente del panel: exige actor autenticado con MFA en CADA llamada (no confía en el proxy). */
export const accionPanel = accionPublica.use(conLimiteDeTasa({ limite: 100, ventanaSegundos: 60 })).use(async ({ next }) => {
  const actor = await obtenerActor()
  if (!actor) throw new NoAutenticado()
  return ejecutarConContextoDb({ modo: 'panel', actor }, () => next({ ctx: { actor } }))
})

/** Permiso `recurso:accion` para una acción del panel. */
export function conPermiso(permiso: Permiso) {
  return createMiddleware<Base & { ctx: { actor: Actor } }>().define(async ({ next, ctx }) => {
    ctx.actor.exigir(permiso)
    return next()
  })
}
