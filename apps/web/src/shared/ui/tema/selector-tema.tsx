'use client'

import { CLAVE_TEMA, type PreferenciaTema, type TemaPanel } from '@proinserco/tokens'
import { useEffect, useState } from 'react'

const OPCIONES: readonly { valor: PreferenciaTema; etiqueta: string }[] = [
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
  { valor: 'sistema', etiqueta: 'Sistema' },
]

const consultaOscuro = () => matchMedia('(prefers-color-scheme: dark)')

function leerPreferencia(): PreferenciaTema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA)
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : 'sistema'
  } catch {
    // localStorage bloqueado (modo privado estricto): se sigue al sistema.
    return 'sistema'
  }
}

function aplicarTema(tema: TemaPanel) {
  const raiz = document.documentElement
  if (raiz.dataset.tema === tema) return
  const cambiar = () => {
    raiz.dataset.tema = tema
  }
  const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || menosMovimiento) return cambiar()
  raiz.dataset.cambiandoTema = ''
  document.startViewTransition(cambiar).finished.finally(() => {
    delete raiz.dataset.cambiandoTema
  })
}

/**
 * Selector Claro · Oscuro · Sistema del panel (radiogroup nativo).
 * Primitiva funcional SIN estilo de marca: el agente del panel la viste.
 */
export function SelectorTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('sistema')

  useEffect(() => {
    setPreferencia(leerPreferencia())
  }, [])

  useEffect(() => {
    if (preferencia !== 'sistema') return aplicarTema(preferencia)
    const consulta = consultaOscuro()
    const seguirSistema = () => aplicarTema(consulta.matches ? 'oscuro' : 'claro')
    seguirSistema()
    consulta.addEventListener('change', seguirSistema)
    return () => consulta.removeEventListener('change', seguirSistema)
  }, [preferencia])

  function elegir(valor: PreferenciaTema) {
    setPreferencia(valor)
    try {
      if (valor === 'sistema') localStorage.removeItem(CLAVE_TEMA)
      else localStorage.setItem(CLAVE_TEMA, valor)
    } catch {
      // Sin persistencia: el tema se aplica igual durante la sesión.
    }
  }

  return (
    <fieldset data-selector-tema="">
      <legend>Tema</legend>
      {OPCIONES.map((o) => (
        <label key={o.valor}>
          <input type="radio" name="tema" value={o.valor} checked={preferencia === o.valor} onChange={() => elegir(o.valor)} />
          {o.etiqueta}
        </label>
      ))}
    </fieldset>
  )
}
