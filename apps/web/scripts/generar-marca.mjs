// Genera los recursos de marca e imágenes del cliente desde docs/01 - Cliente/material.
// Lee los originales SIN moverlos ni modificarlos. Uso: pnpm --filter @proinserco/web marca
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { optimize } from 'svgo'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const MATERIAL = join(WEB, '..', '..', 'docs', '01 - Cliente', 'material')
const PUBLICO = join(WEB, 'public')
const APP = join(WEB, 'src', 'app')

const escribir = (ruta, datos) => {
  mkdirSync(dirname(ruta), { recursive: true })
  writeFileSync(ruta, datos)
}

// ─── Logo SVG optimizado (ids conservados para animarlo) ──────────────────
const original = readFileSync(join(MATERIAL, 'marca', 'proinserco-logo.svg'), 'utf8')
const sinFondo = original
  .replace(/<g id="fondo"[\s\S]*?<\/g>\s*/, '')
  .replace(/<title id="titulo">[^<]*<\/title>/, '<title id="titulo">Fundación Proinserco — Al servicio de la comunidad</title>')
  .replace(/<desc id="descripcion">[^<]*<\/desc>/, '')
  .replace('aria-labelledby="titulo descripcion"', 'aria-labelledby="titulo"')

const opcionesSvgo = {
  multipass: true,
  plugins: [
    // cleanupIds desactivado: los ids de las piezas son la API de la animación del loader.
    { name: 'preset-default', params: { overrides: { cleanupIds: false } } },
    'removeDimensions',
    { name: 'removeAttrs', params: { attrs: ['aria-label', 'xmlns:inkscape'] } },
  ],
}
const conRol = (svg) => svg.replace('<svg ', '<svg role="img" ')
const logo = conRol(optimize(sinFondo, opcionesSvgo).data)
escribir(join(PUBLICO, 'marca', 'proinserco-logo.svg'), logo)

// ─── Logo como componente React en línea (para animarlo en el loader) ─────
const aJsx = (svg) =>
  svg
    .replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (m, attr) =>
      attr.startsWith('aria-') || attr.startsWith('data-') ? m : ` ${attr.replace(/-([a-z])/g, (_, l) => l.toUpperCase())}=`,
    )
    .replace(/\sxmlns="[^"]*"/, '')
    .replace(/\sid="([^"]+)"/g, ' id="$1" data-pieza="$1"')
const svgJsx = aJsx(logo)
const corte = svgJsx.indexOf('<g id="tipografia"')
const cierreTipografia = svgJsx.indexOf('</g>', corte) + 4
const apertura = svgJsx
  .slice(0, svgJsx.indexOf('>') + 1)
  .replace('<svg ', '<svg className={className} aria-hidden={decorativo || undefined} ')
const componente = `// ARCHIVO GENERADO por scripts/generar-marca.mjs — no editar a mano.
/**
 * Logo de la Fundación Proinserco en línea, con los ids de sus piezas
 * conservados para animarlo (loader): #columna-letra-p (barra de la P),
 * #flecha-circular / #base-flecha / #facetas-y-reflejos (aro-flecha),
 * #nombre-marca y #lema (textos). Cada pieza lleva también data-pieza.
 *
 * Usar UNA sola instancia por página: los ids (y los degradados de <defs>)
 * se repetirían. Es una RECREACIÓN vectorial del logo (textos en Georgia);
 * sustituir cuando el cliente entregue el vectorial original.
 */
type Props = {
  className?: string
  /** false = solo el símbolo (aro + P), sin "roinserco" ni el lema. */
  conTexto?: boolean
  /** true si hay texto visible al lado que ya nombra la fundación. */
  decorativo?: boolean
}

export function LogoProinserco({ className, conTexto = true, decorativo = false }: Props) {
  return (
    ${apertura}
      ${svgJsx.slice(svgJsx.indexOf('>') + 1, corte)}
      {conTexto ? (
        ${svgJsx.slice(corte, cierreTipografia)}
      ) : null}
    </svg>
  )
}
`
escribir(join(WEB, 'src', 'shared', 'ui', 'marca', 'logo-proinserco.tsx'), componente)

// Solo el símbolo (aro + barra de la P), encuadrado en un cuadrado: iconos y favicon.
const simbolo = optimize(
  sinFondo
    .replace(/<g id="tipografia"[\s\S]*?<\/g>\s*/, '')
    .replace(/viewBox="[^"]*"/, 'viewBox="208 50 900 900"')
    .replace(/width="\d+" height="\d+"/, 'width="900" height="900"'),
  opcionesSvgo,
).data
escribir(join(PUBLICO, 'marca', 'proinserco-simbolo.svg'), simbolo)
escribir(join(APP, 'icon.svg'), simbolo)

// ─── Iconos raster (fondo crema para que se vean en cualquier sistema) ─────
const CREMA = { r: 245, g: 239, b: 220, alpha: 1 }
async function iconoPng(lado, margen = 0.12, paleta = true) {
  const interior = Math.round(lado * (1 - margen * 2))
  const simboloPng = await sharp(Buffer.from(simbolo), { density: 300 }).resize(interior, interior).png().toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: CREMA } })
    .composite([{ input: simboloPng, gravity: 'center' }])
    .ensureAlpha()
    .png({ compressionLevel: 9, palette: paleta })
    .toBuffer()
}
escribir(join(APP, 'apple-icon.png'), await iconoPng(180))
escribir(join(PUBLICO, 'marca', 'icono-192.png'), await iconoPng(192))
escribir(join(PUBLICO, 'marca', 'icono-512.png'), await iconoPng(512))
escribir(join(PUBLICO, 'marca', 'icono-maskable-512.png'), await iconoPng(512, 0.2))

// favicon.ico con PNG embebidos (16, 32, 48): formato ICO válido sin dependencias.
const tamanos = [16, 32, 48]
const pngs = await Promise.all(tamanos.map((t) => iconoPng(t, 0.04, false)))
const cabecera = Buffer.alloc(6 + 16 * pngs.length)
cabecera.writeUInt16LE(0, 0)
cabecera.writeUInt16LE(1, 2)
cabecera.writeUInt16LE(pngs.length, 4)
let desplazamiento = cabecera.length
pngs.forEach((png, i) => {
  const base = 6 + i * 16
  cabecera.writeUInt8(tamanos[i], base)
  cabecera.writeUInt8(tamanos[i], base + 1)
  cabecera.writeUInt16LE(1, base + 4)
  cabecera.writeUInt16LE(32, base + 6)
  cabecera.writeUInt32LE(png.length, base + 8)
  cabecera.writeUInt32LE(desplazamiento, base + 12)
  desplazamiento += png.length
})
escribir(join(APP, 'favicon.ico'), Buffer.concat([cabecera, ...pngs]))

// ─── Equipo: fotos pequeñas (baja resolución de origen), sin metadatos ─────
const EQUIPO = {
  'jorge-eduardo-orozco-alvarez': 'jorge-eduardo-orozco-alvarez-wix.jpg',
  sharly: 'sharly-wix.jpg',
  'jorge-e-orozco-zuniga': 'jorge-e-orozco-zuniga.png',
  'dora-stella': 'dora-stella.png',
  'luisa-maria': 'luisa-maria.png',
}
const dimensiones = {}
for (const [id, archivo] of Object.entries(EQUIPO)) {
  const salida = join(PUBLICO, 'img', 'equipo', `${id}.jpg`)
  mkdirSync(dirname(salida), { recursive: true })
  const info = await sharp(join(MATERIAL, 'equipo', archivo))
    .rotate()
    .resize({ width: 600, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(salida)
  dimensiones[`/img/equipo/${id}.jpg`] = [info.width, info.height]
}

// ─── Aliados: logos normalizados a PNG (máx. 960 px de ancho) ──────────────
const ALIADOS = [
  'universidad-del-cauca.png',
  'cabildo-indigena-guambia.png',
  'ips-mama-dominga-guambia.jpg',
  'osteosalud.png',
  'fes-ips-sas.png',
  'forjadores-del-futuro.jpg',
  'integrales-colombia.jpg',
]
for (const archivo of ALIADOS) {
  const id = archivo.replace(/\.(png|jpg)$/, '')
  const salida = join(PUBLICO, 'img', 'aliados', `${id}.png`)
  mkdirSync(dirname(salida), { recursive: true })
  const info = await sharp(join(MATERIAL, 'aliados', archivo))
    .resize({ width: 960, height: 580, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(salida)
  dimensiones[`/img/aliados/${id}.png`] = [info.width, info.height]
}

console.log('Marca e imágenes generadas. Dimensiones (actualízalas en contenido-sitio.ts si cambian):')
console.table(dimensiones)
