import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { isIP } from 'node:net'
import { type ExtractTablesWithRelations, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import type { Actor } from '@/shared/domain/actor'
import { NoAutenticado } from '@/shared/domain/errores'
import { obtenerDb } from './cliente'
import type * as schema from './schema'

export type ContextoDb = { modo: 'publico' } | { modo: 'sistema' } | { modo: 'panel'; actor: Actor }

export type ResolvedorActorPanel = () => Actor | null | Promise<Actor | null>

export type TransaccionDb = PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>

const almacenContextoDb = new AsyncLocalStorage<ContextoDb>()
let resolvedorActorPanel: ResolvedorActorPanel | null = null

/**
 * Registra un resolvedor opcional de actor del panel para cuando `conTransaccionDb`
 * se ejecuta sin `AsyncLocalStorage` ni `contextoRespaldo` (p. ej. Server Components).
 */
export function registrarResolvedorActorPanel(fn: ResolvedorActorPanel | null): void {
  resolvedorActorPanel = fn
}

/** Ejecuta `fn` asociando un rol/actor explícito al flujo asíncrono actual. */
export function ejecutarConContextoDb<T>(contexto: ContextoDb, fn: () => Promise<T>): Promise<T> {
  return almacenContextoDb.run(contexto, fn)
}

/** Obtiene el contexto de base de datos vigente en la petición o tarea actual. */
export function obtenerContextoDb(): ContextoDb | undefined {
  return almacenContextoDb.getStore()
}

/**
 * Abre una transacción y aplica `SET LOCAL ROLE` (y claims JWT si es `panel`)
 * antes de ejecutar cualquier consulta. Falla cerrado si no hay contexto.
 */
export async function conTransaccionDb<T>(fn: (tx: TransaccionDb) => Promise<T>, contextoRespaldo?: ContextoDb): Promise<T> {
  let ctx = obtenerContextoDb() ?? contextoRespaldo
  if (!ctx && resolvedorActorPanel) {
    const actor = await resolvedorActorPanel()
    if (actor) ctx = { modo: 'panel', actor }
  }
  if (!ctx) {
    throw new Error('Contexto de base de datos requerido: ejecuta dentro de ejecutarConContextoDb o indica contextoRespaldo')
  }

  if (ctx.modo === 'panel' && ctx.actor.nivel !== 'aal2') {
    throw new NoAutenticado()
  }

  const db = obtenerDb()
  return db.transaction(async (tx) => {
    switch (ctx.modo) {
      case 'publico': {
        await tx.execute(sql`SET LOCAL ROLE proinserco_publico`)
        break
      }
      case 'sistema': {
        await tx.execute(sql`SET LOCAL ROLE proinserco_sistema`)
        break
      }
      case 'panel': {
        const claimsJson = JSON.stringify({
          sub: ctx.actor.usuarioId,
          aal: ctx.actor.nivel,
          app_metadata: { rol: ctx.actor.rol },
        })
        await tx.execute(sql`SET LOCAL ROLE proinserco_panel`)
        await tx.execute(sql`SELECT set_config('request.jwt.claims', ${claimsJson}, true)`)
        break
      }
    }

    return fn(tx)
  })
}

/**
 * Normaliza la IP del cliente para columnas `inet`: si es `'desconocida'`,
 * vacía o inválida retorna `null`.
 */
export function normalizarIpParaInet(ip: string | null | undefined): string | null {
  if (!ip) return null
  const limpia = ip.trim()
  if (!limpia || limpia === 'desconocida') return null
  return isIP(limpia) !== 0 ? limpia : null
}
