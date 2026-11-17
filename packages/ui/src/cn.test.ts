import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('conserva el tamaño propio junto a un color propio', () => {
    expect(cn('text-hero', 'text-texto')).toBe('text-hero text-texto')
  })

  it('resuelve el conflicto entre dos tamaños propios', () => {
    expect(cn('text-t1', 'text-hero')).toBe('text-hero')
  })

  it('resuelve el conflicto entre dos colores propios', () => {
    expect(cn('bg-superficie', 'bg-acento')).toBe('bg-acento')
  })
})
