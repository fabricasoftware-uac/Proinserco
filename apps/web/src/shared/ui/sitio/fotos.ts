import { IMAGENES_DEMO, type ImagenDemo } from '@/modules/contenido'

/** Foto de demostración por nombre de archivo (sin extensión). Falla en build si no existe. */
export function fotoDemo(nombre: string): ImagenDemo {
  const foto = IMAGENES_DEMO.find((i) => i.src === `/img/demo/${nombre}.jpg`)
  if (!foto) throw new Error(`Foto de demostración inexistente: ${nombre}`)
  return foto
}

/** Parte un texto y marca las frases resaltadas (sin HTML crudo). */
export function partirResaltadas(texto: string, frases: readonly string[]) {
  const patron = new RegExp(`(${frases.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return texto.split(patron).map((trozo, i) => ({ trozo, resaltada: frases.includes(trozo), clave: `${i}-${trozo.slice(0, 8)}` }))
}
