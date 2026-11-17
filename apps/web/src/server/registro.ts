import 'server-only'

/**
 * Registro estructurado (JSON por línea) con redacción. Nunca en los logs:
 * contraseñas, tokens, cookies, cabeceras Authorization, números de tarjeta
 * o documento, cuerpos de petición sin filtrar (vault: Estándar de Seguridad).
 */
type Nivel = 'info' | 'advertencia' | 'error'

const CLAVES_SENSIBLES =
  /contrasena|password|secret|secreto|token|authorization|cookie|clave|key|cvv|cvc|tarjeta|card|documento|celular|telefono|correo|email/i
/** 13–19 dígitos seguidos (posible PAN) o con separadores. */
const PATRON_TARJETA = /\b(?:\d[ -]?){13,19}\b/g

export function redactar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 5) return '[profundo]'
  if (typeof valor === 'string') return valor.replace(PATRON_TARJETA, '[redactado]').slice(0, 2000)
  if (typeof valor === 'bigint') return valor.toString()
  if (valor instanceof Error) return { nombre: valor.name, mensaje: redactar(valor.message, profundidad + 1) }
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => redactar(v, profundidad + 1))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, CLAVES_SENSIBLES.test(k) ? '[redactado]' : redactar(v, profundidad + 1)]),
    )
  }
  return valor
}

function escribir(nivel: Nivel, mensaje: string, datos?: Record<string, unknown>) {
  const linea = JSON.stringify({ nivel, mensaje, en: new Date().toISOString(), ...(datos ? (redactar(datos) as object) : {}) })
  if (nivel === 'error') console.error(linea)
  else if (nivel === 'advertencia') console.warn(linea)
  else console.info(linea)
}

export const registro = {
  info: (mensaje: string, datos?: Record<string, unknown>) => escribir('info', mensaje, datos),
  advertencia: (mensaje: string, datos?: Record<string, unknown>) => escribir('advertencia', mensaje, datos),
  error: (mensaje: string, datos?: Record<string, unknown>) => escribir('error', mensaje, datos),
}
