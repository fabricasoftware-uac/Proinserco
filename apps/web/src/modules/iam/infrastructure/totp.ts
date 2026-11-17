import { createHmac, timingSafeEqual } from 'node:crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PASO_SEGUNDOS = 30
const DIGITOS = 6

export function decodificarBase32(texto: string): Buffer {
  const limpio = texto.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let valor = 0
  const salida: number[] = []
  for (const c of limpio) {
    const indice = BASE32.indexOf(c)
    if (indice < 0) throw new Error('Secreto TOTP no es base32')
    valor = (valor << 5) | indice
    bits += 5
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(salida)
}

/** HOTP (RFC 4226) para un contador. */
function hotp(secreto: Buffer, contador: number): string {
  const mensaje = Buffer.alloc(8)
  mensaje.writeBigUInt64BE(BigInt(contador))
  const hmac = createHmac('sha1', secreto).update(mensaje).digest()
  const desplazamiento = (hmac.at(-1) ?? 0) & 0x0f
  const binario = hmac.readUInt32BE(desplazamiento) & 0x7fffffff
  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, '0')
}

export function contadorTotp(ahora: Date): number {
  return Math.floor(ahora.getTime() / 1000 / PASO_SEGUNDOS)
}

/** Código TOTP (RFC 6238, SHA-1, 30 s, 6 dígitos): compatible con cualquier app autenticadora. */
export function generarTotp(secretoBase32: string, ahora: Date): string {
  return hotp(decodificarBase32(secretoBase32), contadorTotp(ahora))
}

/**
 * Verifica con tolerancia de ±1 paso (desfase de reloj). Devuelve el contador
 * que coincidió para impedir reutilizar el mismo código (anti-replay), o null.
 */
export function verificarTotp(secretoBase32: string, codigo: string, ahora: Date, ultimoContadorUsado: number): number | null {
  if (!/^\d{6}$/.test(codigo)) return null
  const secreto = decodificarBase32(secretoBase32)
  const actual = contadorTotp(ahora)
  for (const contador of [actual - 1, actual, actual + 1]) {
    if (contador <= ultimoContadorUsado) continue
    const esperado = Buffer.from(hotp(secreto, contador))
    if (timingSafeEqual(esperado, Buffer.from(codigo))) return contador
  }
  return null
}
