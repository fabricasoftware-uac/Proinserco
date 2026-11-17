/**
 * Verificación anti-bots (Cloudflare Turnstile) SIEMPRE en servidor.
 * Ante cualquier fallo (red, timeout, respuesta rara) devuelve false: falla cerrado.
 */
export interface VerificadorAntiBots {
  verificar(token: string, ip: string): Promise<boolean>
}
