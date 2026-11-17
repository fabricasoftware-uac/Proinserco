import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { nonceCsp } from '@/server/contexto-peticion'
import { fuentesSitio } from '@/shared/ui/fuentes'
import { ScriptTema } from '@/shared/ui/tema/script-tema'
import '@/shared/ui/panel/panel.css'

/** Acceso al panel: dinámico, sin caché, sin indexar, con el tema del panel. */
export const dynamic = 'force-dynamic'
export const fetchCache = 'default-no-store'
export const revalidate = 0

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const viewport: Viewport = { colorScheme: 'light dark' }

export default async function LayoutAcceso({ children }: { children: ReactNode }) {
  return (
    <>
      <ScriptTema nonce={await nonceCsp()} />
      <div data-zona="panel" className={fuentesSitio}>
        {children}
      </div>
    </>
  )
}
