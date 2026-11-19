export type TemaTurnstile = 'light' | 'dark' | 'auto'

/**
 * Tema del widget según el tema de la página: el panel y el sitio fijan <html data-tema>.
 * Sin preferencia explícita, Turnstile sigue a prefers-color-scheme (`auto`).
 */
export function temaTurnstile(temaDocumento: string | undefined): TemaTurnstile {
  if (temaDocumento === 'oscuro') return 'dark'
  if (temaDocumento === 'claro') return 'light'
  return 'auto'
}
