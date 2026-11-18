import { afterEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, obtenerEnvMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  obtenerEnvMock: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

vi.mock('./env', () => ({
  obtenerEnv: obtenerEnvMock,
}))

import { crearClienteAdminSupabase } from './supabase-admin'

describe('crearClienteAdminSupabase', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('falla cerrado si falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY', () => {
    obtenerEnvMock.mockReturnValue({ SUPABASE_URL: 'https://proj.supabase.co' })
    expect(() => crearClienteAdminSupabase()).toThrow('SUPABASE_SERVICE_ROLE_KEY')

    obtenerEnvMock.mockReturnValue({ SUPABASE_SERVICE_ROLE_KEY: 'srv-secret' })
    expect(() => crearClienteAdminSupabase()).toThrow('SUPABASE_URL')
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('crea cliente con autoRefreshToken: false y persistSession: false', () => {
    const clienteFalso = { auth: {} }
    obtenerEnvMock.mockReturnValue({
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv-secret',
    })
    createClientMock.mockReturnValue(clienteFalso)

    const cliente = crearClienteAdminSupabase()

    expect(cliente).toBe(clienteFalso)
    expect(createClientMock).toHaveBeenCalledWith('https://proj.supabase.co', 'srv-secret', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  })
})
