import { z } from 'zod'

/**
 * La CSP (sin 'unsafe-eval') bloquea `new Function`. Zod 4 lo sondea en el
 * primer `parse` para compilar validadores (JIT); el sondeo falla de forma
 * controlada pero el navegador registra una violación de CSP en consola.
 * Con `jitless` no lo intenta. Importar ANTES de cualquier `parse` en el navegador.
 */
z.config({ jitless: true })
