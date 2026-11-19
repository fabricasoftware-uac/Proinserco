// Pruebas del alta de usuarios del panel (node:test, sin dependencias). Ejecutar: pnpm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { enrolarTotp, parsearArgumentos, validarEntrada } from './alta-usuario-panel.mjs'

const BASE = { correo: 'ana@proinserco.test', nombre: 'Ana Muñoz', rol: 'consulta', metodoBd: 'auto' }

/** fetch falso que responde según método + ruta y registra cada llamada. */
function crearFetch(rutas) {
  const llamadas = []
  const fetchFalso = async (url, init) => {
    const { pathname, search } = new URL(url)
    const clave = `${init.method} ${pathname}${search}`
    llamadas.push({ clave, headers: init.headers, body: init.body ? JSON.parse(init.body) : null })
    const manejador = rutas[clave]
    const [status, cuerpo] = typeof manejador === 'function' ? manejador(llamadas.at(-1)) : (manejador ?? [404, { msg: 'no' }])
    return new Response(cuerpo === null ? '' : JSON.stringify(cuerpo), { status })
  }
  return { fetchFalso, llamadas }
}

const RUTAS_OK = {
  'POST /auth/v1/token?grant_type=password': [200, { access_token: 'tok-aal1' }],
  'GET /auth/v1/user': [200, { factors: [{ id: 'f-viejo', factor_type: 'totp', status: 'unverified' }] }],
  'DELETE /auth/v1/factors/f-viejo': [200, {}],
  'POST /auth/v1/factors': [200, { id: 'f-nuevo', totp: { secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/Proinserco:ana' } }],
  'POST /auth/v1/factors/f-nuevo/challenge': [200, { id: 'desafio-1' }],
  'POST /auth/v1/factors/f-nuevo/verify': (ll) =>
    ll.body.code === '123456' ? [200, { access_token: 'tok-aal2' }] : [422, { msg: 'Invalid TOTP code' }],
  'DELETE /auth/v1/factors/f-nuevo': [200, {}],
  'POST /auth/v1/logout?scope=global': [204, null],
}

describe('alta-usuario-panel: argumentos', () => {
  it('rechaza el modo invitación retirado y la contraseña por CLI', () => {
    assert.throws(() => parsearArgumentos(['--modo', 'invitacion']), /ya no existe/)
    assert.throws(() => parsearArgumentos(['--contrasena', 'x']), /historial/)
    assert.equal(parsearArgumentos(['--modo', 'contrasena', '--correo', 'a@b.co']).correo, 'a@b.co')
  })

  it('--restablecer-mfa exige --actualizar-existente', () => {
    assert.throws(() => validarEntrada({ ...BASE, actualizarExistente: false, restablecerMfa: true }), /actualizar-existente/)
    assert.equal(validarEntrada({ ...BASE, actualizarExistente: true, restablecerMfa: true }).restablecerMfa, true)
  })
})

describe('alta-usuario-panel: enrolarTotp', () => {
  it('limpia factores sin verificar, muestra secreto y URI una vez, verifica el primer código y cierra sesiones', async () => {
    const { fetchFalso, llamadas } = crearFetch(RUTAS_OK)
    const mostrado = []
    const codigos = ['12', '000000', '123456']

    const r = await enrolarTotp({
      urlBase: 'http://supabase.test',
      apikey: 'anon',
      correo: 'ana@proinserco.test',
      contrasena: 'una-clave-larga-123',
      fetchImpl: fetchFalso,
      mostrar: (t) => mostrado.push(t),
      pedirCodigo: async () => codigos.shift() ?? '',
    })

    assert.deepEqual(r, { factorId: 'f-nuevo' })
    const texto = mostrado.join('\n')
    assert.equal(texto.split('JBSWY3DPEHPK3PXP').length - 1, 1, 'el secreto se muestra exactamente una vez')
    assert.match(texto, /otpauth:\/\/totp\/Proinserco:ana/)
    const claves = llamadas.map((l) => l.clave)
    assert.ok(claves.includes('DELETE /auth/v1/factors/f-viejo'))
    assert.equal(claves.filter((c) => c.endsWith('/verify')).length, 2)
    assert.equal(claves.at(-1), 'POST /auth/v1/logout?scope=global')
    // Las llamadas como usuario van con su access token, nunca con la clave de servicio.
    assert.equal(llamadas.find((l) => l.clave === 'POST /auth/v1/factors').headers.Authorization, 'Bearer tok-aal1')
  })

  it('si no se verifica en 3 intentos borra el factor a medio crear y falla', async () => {
    const { fetchFalso, llamadas } = crearFetch(RUTAS_OK)
    await assert.rejects(
      enrolarTotp({
        urlBase: 'http://supabase.test',
        apikey: 'anon',
        correo: 'ana@proinserco.test',
        contrasena: 'una-clave-larga-123',
        fetchImpl: fetchFalso,
        mostrar: () => undefined,
        pedirCodigo: async () => '999999',
      }),
      /SIN acceso/,
    )
    const claves = llamadas.map((l) => l.clave)
    assert.ok(claves.includes('DELETE /auth/v1/factors/f-nuevo'))
    assert.equal(claves.at(-1), 'POST /auth/v1/logout?scope=global')
  })

  it('no reemplaza un TOTP ya verificado sin --restablecer-mfa', async () => {
    const { fetchFalso } = crearFetch({
      ...RUTAS_OK,
      'GET /auth/v1/user': [200, { factors: [{ id: 'f-ok', factor_type: 'totp', status: 'verified' }] }],
    })
    await assert.rejects(
      enrolarTotp({
        urlBase: 'http://supabase.test',
        apikey: 'anon',
        correo: 'ana@proinserco.test',
        contrasena: 'una-clave-larga-123',
        fetchImpl: fetchFalso,
        mostrar: () => undefined,
        pedirCodigo: async () => '123456',
      }),
      /restablecer-mfa/,
    )
  })
})
