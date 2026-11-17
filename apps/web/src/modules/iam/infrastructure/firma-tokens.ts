import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Tokens opacos firmados con HMAC-SHA256: `<carga>.<firma>`. La carga solo
 * contiene identificadores aleatorios y fechas; nunca datos personales.
 */
export function crearFirmador(secreto: string) {
  if (secreto.length < 32) throw new Error('SESION_SECRETO debe tener al menos 32 caracteres')
  const firmar = (carga: string) => createHmac('sha256', secreto).update(carga).digest('base64url')

  return {
    firmar(carga: string): string {
      return `${carga}.${firmar(carga)}`
    },
    /** Devuelve la carga si la firma es válida (comparación en tiempo constante), o null. */
    verificar(token: string | undefined): string | null {
      if (!token || token.length > 512) return null
      const corte = token.lastIndexOf('.')
      if (corte <= 0) return null
      const carga = token.slice(0, corte)
      const recibida = Buffer.from(token.slice(corte + 1))
      const esperada = Buffer.from(firmar(carga))
      if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null
      return carga
    },
  }
}
