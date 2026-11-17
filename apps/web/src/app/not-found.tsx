import { fuentesSitioPublico as fuentesSitio } from '@/shared/ui/sitio/fuentes-sitio'
import { PaginaEstado } from '@/shared/ui/sitio/pagina-estado'
import '@/shared/ui/sitio/sitio.css'
import '@/shared/ui/sitio/paginas.css'

/** 404 con la marca. Next responde con estado 404. */
export default function PaginaNoEncontrada() {
  return (
    <div data-zona="publico" data-seccion-tema="crema" className={fuentesSitio}>
      <PaginaEstado
        codigo="404"
        titulo="Este camino no aparece en el mapa"
        texto="Buscamos por todo el Cauca y esta página no está. Puede que el enlace haya cambiado o que se haya perdido una letra por el camino."
      />
    </div>
  )
}
