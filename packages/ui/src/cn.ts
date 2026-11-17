import { type ClassNameValue, extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge con NUESTRA escala tipográfica. Sin esto, `text-hero` se
 * clasifica como color de texto y choca con `text-texto`: el tamaño
 * desaparece en silencio (vault: Gotchas Verificados).
 * Todo --text-* nuevo en packages/tokens/src/semanticos.css se añade aquí.
 */
export const TAMANOS_TEXTO = [
  'micro',
  'pequeno',
  'cuerpo',
  'realce',
  't3',
  't2',
  't1',
  'hero',
  'panel-micro',
  'panel-pequeno',
  'panel-cuerpo',
  'panel-subtitulo',
  'panel-titulo',
] as const

const COLORES = [
  'superficie',
  'superficie-elevada',
  'texto',
  'texto-suave',
  'borde',
  'borde-sutil',
  'acento',
  'sobre-acento',
  'marca',
  'enfasis',
  'peligro',
  'sobre-peligro',
  'foco',
  'transparent',
  'current',
] as const

const fusionar = extendTailwindMerge({
  extend: {
    theme: {
      color: [...COLORES],
      text: [...TAMANOS_TEXTO],
      radius: ['marco', 'tarjeta', 'control', 'pastilla', 'panel', 'panel-pequeno'],
      spacing: ['marco', 'gutter', 'seccion'],
      font: ['titular', 'cuerpo', 'sistema'],
      ease: ['salida', 'expo-salida', 'entrada-salida', 'entrada', 'rebote-suave'],
    },
  },
})

/** Une clases condicionales resolviendo conflictos de Tailwind. */
export function cn(...clases: ClassNameValue[]): string {
  return fusionar(clases)
}
