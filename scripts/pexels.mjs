#!/usr/bin/env node
// Descarga fotos de DEMOSTRACIÓN de Pexels para el sitio (el cliente las
// sustituirá por las suyas). Node puro, sin dependencias.
//
//   pnpm imagenes:pexels            (lee PEXELS_API_KEY de apps/web/.env.local)
//
// Privacidad: a Pexels solo se envía el término de búsqueda (y los parámetros
// de tamaño/orientación). La clave viaja en la cabecera Authorization y nunca
// se imprime ni se escribe en ningún archivo.
// Idempotente: no vuelve a bajar lo ya descargado; respeta las ediciones del
// manifiesto (alt revisados) y la lista de descartes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(RAIZ, 'apps', 'web', 'public', 'img', 'demo')
const MANIFIESTO = join(DESTINO, 'manifiesto.json')
const DESCARTES = join(RAIZ, 'scripts', 'pexels-descartadas.json')

const CLAVE = process.env.PEXELS_API_KEY
if (!CLAVE) {
  console.error('Falta PEXELS_API_KEY (ponla en apps/web/.env.local, nunca en el repositorio).')
  process.exit(1)
}

/** Héroes ≥ 2400 px; tarjetas ≥ 1600 px. `cantidad` = cuántas conservar por búsqueda. */
const BUSQUEDAS = [
  {
    termino: 'colombia andes mountains landscape',
    seccion: 'hero',
    alt: 'Montañas andinas de Colombia cubiertas de verde',
    cantidad: 3,
    minAncho: 2400,
    ancho: 2560,
  },
  {
    termino: 'coffee plantation colombia mountains',
    seccion: 'hero',
    alt: 'Cafetal en ladera en las montañas de Colombia',
    cantidad: 2,
    minAncho: 2400,
    ancho: 2560,
  },
  {
    termino: 'colombian coffee farmer',
    seccion: 'agricola',
    alt: 'Caficultor colombiano en su cultivo',
    cantidad: 3,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'coffee cherries harvest hands',
    seccion: 'agricola',
    alt: 'Manos recogiendo granos de café maduros',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'farmer latin america field',
    seccion: 'agricola',
    alt: 'Agricultor trabajando en el campo',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'hands planting seedling soil',
    seccion: 'agricola',
    alt: 'Manos sembrando una plántula en la tierra',
    cantidad: 1,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'community workshop latin america',
    seccion: 'educacion',
    alt: 'Taller comunitario con personas adultas',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'capacitación comunitaria',
    seccion: 'educacion',
    alt: 'Capacitación con personas de la comunidad',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'latina women meeting community',
    seccion: 'educacion',
    alt: 'Mujeres reunidas en un encuentro comunitario',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'brigada de salud',
    seccion: 'salud',
    alt: 'Brigada de salud en la comunidad',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'nurse rural clinic latin america',
    seccion: 'salud',
    alt: 'Atención de salud en una zona rural',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'rural village colombia',
    seccion: 'territorio',
    alt: 'Pueblo rural entre montañas en Colombia',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  { termino: 'popayan colombia', seccion: 'territorio', alt: 'Popayán, Cauca', cantidad: 1, minAncho: 1600, ancho: 1800 },
  {
    termino: 'colombian countryside people',
    seccion: 'comunidad',
    alt: 'Comunidad rural colombiana',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'campesinos colombia',
    seccion: 'comunidad',
    alt: 'Campesinos colombianos en su territorio',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'colombia farmer woman',
    seccion: 'agricola',
    alt: 'Campesina colombiana en su cultivo',
    cantidad: 1,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'vaccination rural community latin america',
    seccion: 'salud',
    alt: 'Jornada de salud en una comunidad rural',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'rural classroom adults teacher',
    seccion: 'educacion',
    alt: 'Docente con personas adultas en un aula rural',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'colombia mountains village farm',
    seccion: 'territorio',
    alt: 'Finca entre montañas en Colombia',
    cantidad: 2,
    minAncho: 1600,
    ancho: 1800,
  },
  {
    termino: 'coffee farmer hands colombia',
    seccion: 'agricola',
    alt: 'Manos de un caficultor con granos de café',
    cantidad: 1,
    minAncho: 1600,
    ancho: 1800,
  },
  // Fotos del menú (una por enlace, verticales para el marco 4:5 de la previa).
  {
    termino: 'team meeting office latin america',
    seccion: 'comunidad',
    alt: 'Equipo de trabajo reunido alrededor de una mesa',
    cantidad: 1,
    minAncho: 1200,
    ancho: 1400,
    orientacion: 'portrait',
  },
  {
    termino: 'community project planning meeting',
    seccion: 'comunidad',
    alt: 'Reunión de planeación de un proyecto con la comunidad',
    cantidad: 1,
    minAncho: 1200,
    ancho: 1400,
    orientacion: 'portrait',
  },
  {
    termino: 'adult education workshop',
    seccion: 'educacion',
    alt: 'Taller de formación con personas adultas',
    cantidad: 1,
    minAncho: 1200,
    ancho: 1400,
    orientacion: 'portrait',
  },
  {
    termino: 'colombia andes valley green',
    seccion: 'territorio',
    alt: 'Valle verde de montaña en los Andes colombianos',
    cantidad: 1,
    minAncho: 1200,
    ancho: 1400,
    orientacion: 'portrait',
  },
  {
    termino: 'diverse team working together table',
    seccion: 'comunidad',
    alt: 'Equipo de personas trabajando juntas alrededor de una mesa',
    cantidad: 1,
    minAncho: 1200,
    ancho: 1400,
    orientacion: 'portrait',
  },
  {
    termino: 'popayan',
    seccion: 'territorio',
    alt: 'Popayán, Cauca',
    cantidad: 1,
    minAncho: 1200,
    ancho: 1400,
    orientacion: 'portrait',
  },
]

const leerJson = (ruta, porDefecto) => (existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : porDefecto)

/** Ancho y alto de un JPEG leyendo su marcador SOF (sin dependencias). */
function dimensionesJpeg(buf) {
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null
    const marcador = buf[i + 1]
    const largo = buf.readUInt16BE(i + 2)
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) }
    }
    i += 2 + largo
  }
  return null
}

async function pexels(url) {
  const r = await fetch(url, {
    headers: { Authorization: CLAVE, 'User-Agent': 'descargador-imagenes/1.0' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) throw new Error(`Pexels respondió ${r.status} para ${new URL(url).pathname}`)
  return r
}

mkdirSync(DESTINO, { recursive: true })
const manifiesto = leerJson(MANIFIESTO, [])
const descartadas = new Set(leerJson(DESCARTES, []).map(String))
const yaTenemos = new Set(manifiesto.map((e) => String(e.id)))
const autoresUsados = new Set(manifiesto.map((e) => e.autor))

/** Tope total: pocas fotos, todas revisadas a mano (las descartadas van a pexels-descartadas.json). */
const MAXIMO_FOTOS = 27

// SOLO_MENU=1: procesa únicamente las búsquedas con orientación propia (fotos del menú).
const soloMenu = process.env.SOLO_MENU === '1'

for (const b of BUSQUEDAS) {
  if (soloMenu && !b.orientacion) continue
  if (manifiesto.length >= MAXIMO_FOTOS) break
  const actuales = manifiesto.filter((e) => e.consulta === b.termino).length
  if (actuales >= b.cantidad) continue
  const consulta = new URL('https://api.pexels.com/v1/search')
  consulta.searchParams.set('query', b.termino)
  consulta.searchParams.set('per_page', '40')
  consulta.searchParams.set('orientation', b.orientacion ?? 'landscape')
  const { photos } = await (await pexels(consulta)).json()

  let faltan = b.cantidad - actuales
  for (const foto of photos) {
    if (faltan === 0 || manifiesto.length >= MAXIMO_FOTOS) break
    const id = String(foto.id)
    // Se descartan: ya descargadas, rechazadas al revisarlas, pequeñas y del mismo
    // autor (evita que la página parezca ilustrada con una sola sesión de fotos).
    if (yaTenemos.has(id) || descartadas.has(id) || foto.width < b.minAncho || autoresUsados.has(foto.photographer)) continue

    const urlImagen = new URL(foto.src.original)
    urlImagen.searchParams.set('auto', 'compress')
    urlImagen.searchParams.set('cs', 'tinysrgb')
    urlImagen.searchParams.set('w', String(b.ancho))
    const datos = Buffer.from(await (await pexels(urlImagen)).arrayBuffer())
    const dim = dimensionesJpeg(datos)
    if (!dim || dim.ancho < Math.min(b.minAncho, b.ancho)) continue

    const archivo = `${b.seccion}-${id}.jpg`
    writeFileSync(join(DESTINO, archivo), datos)
    manifiesto.push({
      id: foto.id,
      archivo,
      sección: b.seccion,
      alt: b.alt,
      autor: foto.photographer,
      autorUrl: foto.photographer_url,
      url: foto.url,
      ancho: dim.ancho,
      alto: dim.alto,
      consulta: b.termino,
    })
    yaTenemos.add(id)
    autoresUsados.add(foto.photographer)
    faltan -= 1
    console.log(`✓ ${archivo} (${dim.ancho}×${dim.alto}) — ${foto.photographer}`)
  }
  if (faltan > 0) console.warn(`! "${b.termino}": faltan ${faltan} fotos que cumplan los requisitos`)
}

writeFileSync(MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`)
console.log(`Manifiesto: ${manifiesto.length} fotos en apps/web/public/img/demo/manifiesto.json`)
