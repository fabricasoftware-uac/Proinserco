import { describe, expect, it } from 'vitest'
import { temaTurnstile } from './tema-turnstile'

describe('tema del widget de Turnstile', () => {
  it('sigue el tema de la página (claro/oscuro) o el del sistema', () => {
    expect(temaTurnstile('oscuro')).toBe('dark')
    expect(temaTurnstile('claro')).toBe('light')
    expect(temaTurnstile(undefined)).toBe('auto')
  })
})
