import { Hero, QueHacemos, QuienesSomos } from '@/shared/ui/sitio/secciones-apertura'
import { Aliados, Contacto, DonarCta, Equipo, Valores } from '@/shared/ui/sitio/secciones-cierre'
import { Capacitaciones, ComoTrabajamos, Territorio } from '@/shared/ui/sitio/secciones-trabajo'

/**
 * Página principal: una sola página larga de PLANOS de color a pantalla
 * completa, cada sección con su formato y su entrada. Las secciones son de
 * servidor (contenido real tipado); el movimiento lo declaran con atributos
 * (motor escena.tsx) y lo afinan sus piezas cliente (*-vivo.tsx).
 * Orden de color: hero (foto) → bosque (donar) → crema → crema/bosque (persiana)
 * → crema → crema → bosque → crema claro (valores) → crema → bosque → crema → footer bosque.
 */
export default function PaginaInicio() {
  return (
    <main>
      <Hero />
      {/* Donar justo después del hero: muchos usuarios no llegan al final. */}
      <DonarCta />
      <QuienesSomos />
      <QueHacemos />
      <ComoTrabajamos />
      <Capacitaciones />
      <Territorio />
      <Valores />
      <Aliados />
      <Equipo />
      <Contacto />
    </main>
  )
}
