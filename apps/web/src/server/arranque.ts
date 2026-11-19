import { validarEnv } from './env-esquema'

/**
 * Validación del entorno al ARRANCAR el servidor (runtime de Node). La llama
 * src/instrumentation.ts. Sin 'server-only': instrumentation no corre en la capa
 * react-server, y este módulo no expone secretos (solo nombres de variables).
 *
 * En producción fuera de Vercel (Docker/Coolify) termina el proceso: el contenedor
 * queda en error y Coolify no lo pone en servicio. En Vercel o en desarrollo lanza.
 */
export function validarEntornoAlArrancar(): void {
  const resultado = validarEnv(process.env)
  if (resultado.ok) return

  // Solo nombres de variables y motivos: nunca los valores.
  console.error(
    JSON.stringify({
      nivel: 'error',
      mensaje: 'Arranque detenido: variables de entorno inválidas',
      problemas: resultado.problemas,
    }),
  )
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) process.exit(1)
  throw new Error('Configuración de entorno inválida. Revisa el log del servidor y .env.example')
}
