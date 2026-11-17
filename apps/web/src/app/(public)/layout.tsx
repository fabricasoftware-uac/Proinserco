import type { ReactNode } from 'react'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { nonceCsp } from '@/server/contexto-peticion'
import { BannerCookies } from '@/shared/ui/legal/banner-cookies'
import { Cursor } from '@/shared/ui/sitio/cursor'
import type { PreviaMenu } from '@/shared/ui/sitio/enlaces'
import { Escena } from '@/shared/ui/sitio/escena'
import { FijosInferiores } from '@/shared/ui/sitio/fijos-inferiores'
import { Footer } from '@/shared/ui/sitio/footer'
import { fotoDemo } from '@/shared/ui/sitio/fotos'
import { fuentesSitioPublico } from '@/shared/ui/sitio/fuentes-sitio'
import { Loader } from '@/shared/ui/sitio/loader'
import { Navbar } from '@/shared/ui/sitio/navbar'
import { ProveedorMovimiento } from '@/shared/ui/sitio/proveedor-movimiento'
import { Transicion } from '@/shared/ui/sitio/transicion'
import '@/shared/ui/sitio/sitio.css'
import '@/shared/ui/sitio/secciones.css'
import '@/shared/ui/sitio/paginas.css'

/*
 * Sitio público. Renderizado dinámico a propósito: la CSP lleva un nonce
 * por petición y una página prerenderizada en el build tendría un nonce
 * distinto → TODO el JavaScript bloqueado (vault: Cabeceras y CSP, opción 1).
 *
 * /sitio/intro.js es un script EXTERNO con nonce (nada en línea): marca
 * <html data-anim / data-intro> antes del primer pintado para que los estados
 * iniciales de las animaciones y el loader no destellen.
 */
export const dynamic = 'force-dynamic'

const { contacto } = CONTENIDO_SITIO

/** Fotos que asoman en el menú al pasar por cada enlace. */
const PREVIAS: readonly PreviaMenu[] = [
  { id: 'quienes-somos', src: fotoDemo('comunidad-12903168').src },
  { id: 'que-hacemos', src: fotoDemo('comunidad-5324967').src },
  { id: 'capacitaciones', src: fotoDemo('educacion-5756752').src },
  { id: 'territorio', src: fotoDemo('territorio-17382129').src },
  { id: 'equipo', src: fotoDemo('comunidad-8837596').src },
  { id: 'contacto', src: fotoDemo('territorio-13200191').src },
]

export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const nonce = await nonceCsp()
  return (
    <div data-zona="publico" data-seccion-tema="crema" className={`${fuentesSitioPublico} sitio relative overflow-x-clip`}>
      <script nonce={nonce} src="/sitio/intro.js" />
      <a href="#contenido" data-saltar="" className="saltar-contenido">
        Saltar al contenido
      </a>
      <Loader />
      <ProveedorMovimiento />
      <Navbar
        previas={PREVIAS}
        telefono={{ texto: contacto.telefono, enlace: contacto.whatsapp }}
        direccion={`${contacto.direccion}, ${contacto.barrio}, ${contacto.ciudad}`}
      />
      <div id="contenido" tabIndex={-1} className="relative outline-none">
        {children}
      </div>
      <Footer />
      <FijosInferiores />
      <BannerCookies />
      <Transicion />
      <Cursor />
      <Escena />
    </div>
  )
}
