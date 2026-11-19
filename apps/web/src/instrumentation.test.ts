import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from './instrumentation'

describe('instrumentation: validación del entorno al ARRANCAR', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('en producción (Docker/VPS) con entorno inválido termina el proceso con un error claro y sin valores', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PHASE', 'phase-production-server')
    vi.stubEnv('APP_URL', 'https://proinserco.org')
    vi.stubEnv('SESION_SECRETO', 'secreto-que-no-debe-salir-en-el-log-123456')
    vi.stubEnv('ADAPTADORES', 'memoria')
    vi.stubEnv('VERCEL', undefined)
    const salir = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(register()).rejects.toThrow('Configuración de entorno inválida')
    expect(salir).toHaveBeenCalledWith(1)
    const linea = String(log.mock.calls[0]?.[0])
    expect(linea).toContain('Arranque detenido')
    expect(linea).toContain('ADAPTADORES')
    expect(linea).not.toContain('secreto-que-no-debe-salir')
  })

  it('en Vercel sin LIMITADOR_URL falla el arranque de la función (sin process.exit)', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://proinserco.vercel.app')
    vi.stubEnv('SESION_SECRETO', 's'.repeat(40))
    vi.stubEnv('ADAPTADORES', 'memoria')
    vi.stubEnv('ADAPTADORES_MEMORIA_EN_PRODUCCION', 'si')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('LIMITADOR_URL', undefined)
    const salir = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(register()).rejects.toThrow('Configuración de entorno inválida')
    expect(salir).not.toHaveBeenCalled()
    expect(String(log.mock.calls[0]?.[0])).toContain('LIMITADOR_URL')
  })

  it('no valida durante next build ni en el runtime edge', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    vi.stubEnv('APP_URL', undefined)
    await expect(register()).resolves.toBeUndefined()
    vi.stubEnv('NEXT_RUNTIME', 'edge')
    vi.stubEnv('NEXT_PHASE', 'phase-production-server')
    await expect(register()).resolves.toBeUndefined()
    expect(log).not.toHaveBeenCalled()
  })
})
