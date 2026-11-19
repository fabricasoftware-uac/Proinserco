/**
 * Arranque del servidor (Next llama a `register` una vez por instancia, antes de
 * atender peticiones). Valida las variables de entorno para que una configuración
 * inválida —por ejemplo serverless (Vercel) sin `LIMITADOR_URL`— falle AL ARRANCAR
 * con un error claro, no en la primera petición de un donante.
 *
 * - Solo en el runtime de Node (el proxy/edge no lee secretos).
 * - Nunca durante `next build`: el build no tiene (ni debe tener) los secretos.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { validarEntornoAlArrancar } = await import('./server/arranque')
  validarEntornoAlArrancar()
}
