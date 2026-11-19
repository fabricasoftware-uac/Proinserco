#!/usr/bin/env node
// Comprueba la clave de sitio de Turnstile ANTES de construir la imagen de producción.
//
// `NEXT_PUBLIC_TURNSTILE_SITE_KEY` se incrusta en el JavaScript en tiempo de build: si falta,
// `src/shared/env-publico.ts` usa la clave de PRUEBAS de Cloudflare y el formulario de donar
// quedaría protegido por un widget que siempre aprueba. Este script hace fallar el build.
//
// Modo estricto (falla): EXIGIR_CLAVE_TURNSTILE_REAL=si (Dockerfile y CI de producción) o
// VERCEL_ENV=production (build de producción en Vercel). En cualquier otro caso solo avisa.

import { pathToFileURL } from 'node:url'

/** Claves de PRUEBA de Cloudflare (siempre pasan, siempre fallan o fuerzan el reto): 1x0000…, 2x0000…, 3x0000…. */
export function esClaveDePrueba(clave) {
  return /^[123]x0000/.test(clave)
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, estricto: boolean, motivo: string | null }}
 */
export function evaluarClaveTurnstile(env) {
  const estricto = env.EXIGIR_CLAVE_TURNSTILE_REAL === 'si' || env.VERCEL_ENV === 'production'
  const clave = (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
  let motivo = null
  if (!clave) motivo = 'Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY: se usaría la clave de pruebas de Cloudflare.'
  else if (esClaveDePrueba(clave)) motivo = 'NEXT_PUBLIC_TURNSTILE_SITE_KEY es una clave de PRUEBAS de Cloudflare.'
  return { ok: motivo === null || !estricto, estricto, motivo }
}

function principal() {
  const { ok, estricto, motivo } = evaluarClaveTurnstile(process.env)
  if (!motivo) {
    console.log('Turnstile: clave de sitio de producción presente.')
    return
  }
  if (ok) {
    console.warn(`Aviso (build no productivo): ${motivo}`)
    return
  }
  console.error(
    `Build de producción detenido: ${motivo}\n` +
      'Define la variable del repositorio (GitHub → Settings → Variables) o del proyecto en Vercel con la clave real del widget.',
  )
  process.exitCode = estricto ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal()
