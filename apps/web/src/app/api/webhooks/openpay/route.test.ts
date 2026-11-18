import { describe, expect, it } from 'vitest'
import { GET, POST } from './route'

describe('ruta heredada /api/webhooks/openpay', () => {
  it('responde 404 para GET y POST', () => {
    expect(GET().status).toBe(404)
    expect(POST().status).toBe(404)
  })
})
