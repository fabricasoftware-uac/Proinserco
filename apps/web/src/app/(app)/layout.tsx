import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { cerrarSesionAccion } from '@/modules/iam/ui/acciones'
import { requireActor } from '@/server/auth-context'
import { nonceCsp } from '@/server/contexto-peticion'
import { fuentesSitio } from '@/shared/ui/fuentes'
import { ArmazonPanel, type ItemNavegacion } from '@/shared/ui/panel/armazon'
import { ScriptTema } from '@/shared/ui/tema/script-tema'
import '@/shared/ui/panel/panel.css'

/*
 * Panel de administración. NUNCA se cachea: una página autenticada cacheada
 * filtra los datos de un usuario a otro. Se declara explícito, no se infiere.
 * El layout autentica, pero CADA página vuelve a llamar a requireActor(permiso):
 * los layouts no se re-ejecutan en todas las navegaciones.
 */
export const dynamic = 'force-dynamic'
export const fetchCache = 'default-no-store'
export const revalidate = 0

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const viewport: Viewport = { colorScheme: 'light dark' }

async function cerrarSesion() {
  'use server'
  await cerrarSesionAccion()
}

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const actor = await requireActor()

  // La navegación solo OCULTA lo que no corresponde (UX). Cada página y acción exige su permiso en el servidor.
  const items: ItemNavegacion[] = [
    { href: '/panel', etiqueta: 'Resumen', icono: 'resumen', exacto: true },
    ...(actor.puede('donaciones:leer')
      ? [{ href: '/panel/donaciones', etiqueta: 'Donaciones', icono: 'donaciones' as const }]
      : []),
    ...(actor.puede('donantes:leer') ? [{ href: '/panel/donantes', etiqueta: 'Donantes', icono: 'donantes' as const }] : []),
    ...(actor.puede('auditoria:leer') ? [{ href: '/panel/auditoria', etiqueta: 'Auditoría', icono: 'auditoria' as const }] : []),
    ...(actor.puede('ajustes:leer') ? [{ href: '/panel/ajustes', etiqueta: 'Ajustes', icono: 'ajustes' as const }] : []),
  ]

  return (
    <>
      <ScriptTema nonce={await nonceCsp()} />
      <div data-zona="panel" className={fuentesSitio}>
        <ArmazonPanel
          items={items}
          usuario={{ nombre: actor.nombre, correo: actor.correo, rol: actor.rol }}
          puedeBuscar={actor.puede('donaciones:leer')}
          puedeAjustes={actor.puede('ajustes:leer')}
          cerrarSesion={cerrarSesion}
        >
          {children}
        </ArmazonPanel>
      </div>
    </>
  )
}
