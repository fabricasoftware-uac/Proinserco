import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CURVAS, DURACIONES_MS, TEMAS_SECCION } from './index'

const leer = (archivo: string) => readFileSync(fileURLToPath(new URL(archivo, import.meta.url)), 'utf8')

const primitivosCss = leer('./primitivos.css')
const semanticosCss = leer('./semanticos.css')

/** --nombre: #rrggbb  →  { nombre: '#rrggbb' } */
function leerPrimitivos(css: string): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    const [, nombre, valor] = m
    if (nombre && valor) mapa.set(nombre, valor.trim())
  }
  return mapa
}

type Bloque = { selector: string; variables: Map<string, string> }

/** Bloques de primer nivel `selector { --a: var(--b); }` (sin anidar). */
function leerBloques(css: string): Bloque[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const bloques: Bloque[] = []
  for (const m of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (m[1] ?? '').trim()
    if (selector.startsWith('@')) continue
    const variables = new Map<string, string>()
    for (const v of (m[2] ?? '').matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)/g)) {
      if (v[1] && v[2]) variables.set(v[1], v[2])
    }
    bloques.push({ selector, variables })
  }
  return bloques
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '')
  const canales = [0, 2, 4].map((i) => Number.parseInt(limpio.slice(i, i + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = canales.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (claro + 0.05) / (oscuro + 0.05)
}

const primitivos = leerPrimitivos(primitivosCss)
const bloques = leerBloques(semanticosCss)

const temas: Record<string, (selector: string) => boolean> = {
  ...Object.fromEntries(TEMAS_SECCION.map((t) => [`sitio/${t}`, (s: string) => s.includes(`[data-seccion-tema='${t}']`)])),
  'panel/claro': (s) => s === "[data-zona='panel']",
  'panel/oscuro': (s) => s.includes("[data-tema='oscuro']"),
}

function resolver(tema: string, papel: string): string {
  const coincide = temas[tema]
  const bloque = bloques.find((b) => coincide?.(b.selector))
  const primitivo = bloque?.variables.get(papel)
  const valor = primitivo ? primitivos.get(primitivo) : undefined
  if (!valor?.startsWith('#')) throw new Error(`No se resolvió --${papel} en ${tema}`)
  return valor
}

const pares = [
  ['texto', 'superficie', 4.5],
  ['texto-suave', 'superficie', 4.5],
  ['texto', 'superficie-elevada', 4.5],
  ['sobre-acento', 'acento', 4.5],
  ['marca', 'superficie', 4.5],
  ['enfasis', 'superficie', 4.5],
  ['sobre-peligro', 'peligro', 4.5],
  ['borde', 'superficie', 3],
  ['foco', 'superficie', 3],
  ['acento', 'superficie', 3],
] as const

describe('contraste AA de los tokens semánticos', () => {
  for (const tema of Object.keys(temas)) {
    for (const [texto, fondo, minimo] of pares) {
      it(`${tema}: ${texto} sobre ${fondo} ≥ ${minimo}:1`, () => {
        expect(contraste(resolver(tema, texto), resolver(tema, fondo))).toBeGreaterThanOrEqual(minimo)
      })
    }
  }
})

describe('espejo TypeScript de los tokens', () => {
  it('las curvas coinciden con primitivos.css', () => {
    expect(primitivos.get('curva-salida')).toBe(CURVAS.salida)
    expect(primitivos.get('curva-expo-salida')).toBe(CURVAS.expoSalida)
    expect(primitivos.get('curva-entrada-salida')).toBe(CURVAS.entradaSalida)
    expect(primitivos.get('curva-entrada')).toBe(CURVAS.entrada)
    expect(primitivos.get('curva-rebote-suave')).toBe(CURVAS.reboteSuave)
  })

  it('las duraciones coinciden con primitivos.css', () => {
    for (const [nombre, ms] of Object.entries(DURACIONES_MS)) {
      expect(primitivos.get(`duracion-${nombre}`)).toBe(`${ms}ms`)
    }
  })
})
