import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ContenidoSitio } from '../domain/esquemas'
import { CONTENIDO_SITIO } from './contenido-sitio'

const PUBLICO = fileURLToPath(new URL('../../../../public', import.meta.url))

describe('contenido del sitio', () => {
  it('cumple el esquema', () => {
    expect(ContenidoSitio.safeParse(CONTENIDO_SITIO).success).toBe(true)
  })

  it('las palabras resaltadas aparecen en los párrafos', () => {
    const texto = CONTENIDO_SITIO.quienesSomos.parrafos.join(' ')
    for (const palabra of CONTENIDO_SITIO.quienesSomos.resaltadas) expect(texto).toContain(palabra)
  })

  it('toda imagen referenciada existe en public/', () => {
    const rutas = [
      ...CONTENIDO_SITIO.aliados.lista.map((a) => a.logo.src),
      ...CONTENIDO_SITIO.equipo.miembros.map((m) => m.foto.src),
    ]
    for (const ruta of rutas) expect(existsSync(`${PUBLICO}${ruta}`), ruta).toBe(true)
  })

  it('los créditos del footer apuntan a los dominios acordados', () => {
    expect(CONTENIDO_SITIO.creditos.map((c) => c.url)).toEqual(['https://www.fabsoft.app/'])
  })
})
