import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import { obtenerEnv } from '../env'
import * as schema from './schema'

export type BaseDatos = PostgresJsDatabase<typeof schema>

const CLAVE_GLOBAL = Symbol.for('proinserco.db')

type EstadoDb = {
  sql: Sql
  db: BaseDatos
}

type ConEstadoDb = typeof globalThis & {
  [CLAVE_GLOBAL]?: EstadoDb
}

/**
 * Devuelve la instancia singleton de Drizzle sobre `postgres.js`.
 * Usa `prepare: false` por compatibilidad obligatoria con Supavisor en
 * Transaction Mode (puerto 6543).
 */
export function obtenerDb(): BaseDatos {
  const global = globalThis as ConEstadoDb
  if (global[CLAVE_GLOBAL]) return global[CLAVE_GLOBAL].db

  const env = obtenerEnv()
  if (!env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en la configuración del servidor para conectar con PostgreSQL')
  }

  const sqlClient = postgres(env.DATABASE_URL, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  const db: BaseDatos = drizzle(sqlClient, { schema })
  global[CLAVE_GLOBAL] = { sql: sqlClient, db }
  return db
}

/** Cierra el pool de conexiones PostgreSQL si está inicializado. */
export async function cerrarDb(): Promise<void> {
  const global = globalThis as ConEstadoDb
  const estado = global[CLAVE_GLOBAL]
  if (!estado) return
  delete global[CLAVE_GLOBAL]
  await estado.sql.end({ timeout: 5 })
}
