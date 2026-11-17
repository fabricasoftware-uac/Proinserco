import 'server-only'
import { timingSafeEqual } from 'node:crypto'

/** Respuesta de error con la forma única del contrato REST (vault: API REST - Contrato). */
export function respuestaError(status: number, code: string, message: string, requestId: string, extra?: HeadersInit): Response {
  return Response.json(
    { error: { code, message, requestId } },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId, ...extra } },
  )
}

/** Comparación en tiempo constante de dos cadenas (no filtra la longitud por tiempo de forma útil). */
export function igualesConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba)
    return false
  }
  return timingSafeEqual(ba, bb)
}

/** Valida una cabecera `Authorization: Basic …` contra usuario y contraseña esperados. */
export function basicAuthValido(cabecera: string | null, usuario: string, contrasena: string): boolean {
  if (!cabecera?.startsWith('Basic ') || cabecera.length > 512) return false
  let decodificado: string
  try {
    decodificado = Buffer.from(cabecera.slice(6), 'base64').toString('utf8')
  } catch {
    return false
  }
  const corte = decodificado.indexOf(':')
  if (corte < 0) return false
  const okUsuario = igualesConstante(decodificado.slice(0, corte), usuario)
  const okContrasena = igualesConstante(decodificado.slice(corte + 1), contrasena)
  return okUsuario && okContrasena
}

export class CuerpoDemasiadoGrande extends Error {}

/** Lee el cuerpo como texto cortando en `maxBytes`: nunca `request.json()` a ciegas. */
export async function leerCuerpoConLimite(request: Request, maxBytes: number): Promise<string> {
  const declarado = Number(request.headers.get('content-length') ?? 0)
  if (declarado > maxBytes) throw new CuerpoDemasiadoGrande()
  if (!request.body) return ''
  const lector = request.body.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await lector.cancel()
      throw new CuerpoDemasiadoGrande()
    }
    trozos.push(value)
  }
  return Buffer.concat(trozos).toString('utf8')
}
