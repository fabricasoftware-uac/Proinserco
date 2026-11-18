import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { obtenerEnv } from './env'

/**
 * Cliente administrativo de Supabase con `service_role` (se salta RLS por completo).
 * Uso exclusivo administrativo o de scripts fuera de peticiones de usuario.
 */
export function crearClienteAdminSupabase(): SupabaseClient {
  const env = obtenerEnv()
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para crear el cliente administrativo de Supabase')
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
