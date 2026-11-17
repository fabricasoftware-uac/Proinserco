// Regla del vault (Tokens, Tema Claro y Oscuro): ningún archivo de la app ni
// de packages/ui usa un token PRIMITIVO. Solo semánticos (bg-superficie…).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TONOS = ['crema', 'bosque', 'hoja', 'lima', 'terracota', 'sol', 'cielo', 'tinta', 'rojo', 'neutro']
const PATRON = new RegExp(`(--|[a-z]-)(${TONOS.join('|')})-\\d{1,3}\\b`)
const RAICES = ['apps/web/src', 'packages/ui/src']
const EXTENSIONES = /\.(tsx?|css|mjs)$/

const infracciones = []
function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else if (EXTENSIONES.test(nombre)) {
      readFileSync(ruta, 'utf8')
        .split('\n')
        .forEach((linea, i) => {
          if (PATRON.test(linea)) infracciones.push(`${ruta}:${i + 1}: ${linea.trim()}`)
        })
    }
  }
}
for (const raiz of RAICES) recorrer(raiz)

if (infracciones.length) {
  console.error('Tokens primitivos usados fuera de packages/tokens (usa los semánticos):')
  for (const l of infracciones) console.error(`  ${l}`)
  process.exit(1)
}
console.log('verificar-primitivos: sin primitivos fuera de packages/tokens')
