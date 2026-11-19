import 'server-only'
import { type Env, validarEnv } from './env-esquema'

export { type Env, esServerless } from './env-esquema'

/**
 * Variables de entorno del SERVIDOR, validadas con Zod (esquema en ./env-esquema.ts).
 * Se validan en el primer uso (no al importar) para que `next build` no exija los
 * secretos de producción; además src/instrumentation.ts las valida al ARRANCAR el
 * servidor, de modo que una configuración inválida falla en el arranque con un error claro.
 * Las públicas (NEXT_PUBLIC_*) viven en src/shared/env-publico.ts.
 */
let cache: Env | null = null

export function obtenerEnv(): Env {
  if (cache) return cache
  const resultado = validarEnv(process.env)
  if (!resultado.ok) {
    // Solo nombres de variables y motivos: nunca los valores.
    console.error(JSON.stringify({ nivel: 'error', mensaje: 'Variables de entorno inválidas', problemas: resultado.problemas }))
    throw new Error('Configuración de entorno inválida. Revisa el log del servidor y .env.example')
  }
  cache = resultado.env
  return cache
}
