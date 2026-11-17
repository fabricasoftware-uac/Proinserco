import { describe, expect, it } from 'vitest'
import { celdaCsv, documentoCsv } from './csv'

describe('CSV seguro', () => {
  it.each(['=SUMA(A1)', '+57300', '-1', '@usuario', '\tTAB', '\rCR'])('neutraliza formulas: %j', (entrada) => {
    expect(celdaCsv(entrada).replace(/^"/, '').startsWith("'")).toBe(true)
  })

  it('no toca texto normal ni numeros', () => {
    expect(celdaCsv('Maria L.')).toBe('Maria L.')
    expect(celdaCsv(50000)).toBe('50000')
  })

  it('escapa comillas, comas y saltos de linea', () => {
    expect(celdaCsv('a,b')).toBe('"a,b"')
    expect(celdaCsv('di "hola"')).toBe('"di ""hola"""')
    expect(celdaCsv('l1\nl2')).toBe('"l1\nl2"')
  })

  it('arma el documento con BOM y CRLF', () => {
    expect(documentoCsv(['a', 'b'], [['=x', 1]])).toBe("﻿a,b\r\n'=x,1\r\n")
  })
})
