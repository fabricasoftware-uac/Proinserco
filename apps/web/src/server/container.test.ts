import { afterEach, describe, expect, it, vi } from 'vitest'

const CLAVE = Symbol.for('proinserco.contenedor')

async function contenedorCon(env: Record<string, string>) {
  vi.resetModules()
  delete (globalThis as Record<symbol, unknown>)[CLAVE]
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  const { obtenerContenedor } = await import('./container')
  return obtenerContenedor()
}

const BASE = { APP_URL: 'http://localhost:3000', SESION_SECRETO: 's'.repeat(40), ADAPTADORES: 'memoria' }

describe('composition root: modo memoria', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (globalThis as Record<symbol, unknown>)[CLAVE]
  })

  it('fuera de producción trae pasarela simulada y usuarios demo: se puede donar y entrar al panel sin Supabase', async () => {
    const c = await contenedorCon({ ...BASE, NODE_ENV: 'development' })
    expect(c.pasarelaSimulada).not.toBeNull()

    const cookies = new Map<string, string>()
    const almacen = {
      obtener: (n: string) => cookies.get(n),
      todas: () => [...cookies].map(([nombre, valor]) => ({ nombre, valor })),
      establecer: (n: string, v: string) => void cookies.set(n, v),
      eliminar: (n: string) => void cookies.delete(n),
    }
    await expect(
      c.iam.iniciarSesion({ correo: 'admin@demo.proinserco.test', contrasena: 'Demo-Proinserco-2026!' }, almacen, null),
    ).resolves.toEqual({ requiereSegundoFactor: true })
  })

  it('una demo pública en producción (ADAPTADORES_MEMORIA_EN_PRODUCCION=si) arranca SIN pasarela simulada ni usuarios demo', async () => {
    const c = await contenedorCon({
      ...BASE,
      NODE_ENV: 'production',
      ADAPTADORES_MEMORIA_EN_PRODUCCION: 'si',
      ANTIBOTS_MEMORIA_EN_PRODUCCION: 'si',
    })
    expect(c.pasarelaSimulada).toBeNull()
    const almacen = { obtener: () => undefined, todas: () => [], establecer: () => undefined, eliminar: () => undefined }
    await expect(
      c.iam.iniciarSesion({ correo: 'admin@demo.proinserco.test', contrasena: 'Demo-Proinserco-2026!' }, almacen, null),
    ).rejects.toThrow('Correo o contraseña incorrectos')
  })
})
