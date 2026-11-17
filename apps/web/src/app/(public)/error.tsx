'use client'

import { PaginaEstado } from '@/shared/ui/sitio/pagina-estado'

/**
 * Error del sitio público. NUNCA muestra `error.message`: solo el `digest`,
 * que en el log del servidor lleva a la traza. No se llama `Error`.
 */
export default function ErrorPublico({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PaginaEstado
      codigo="500"
      titulo="Se nos enredó la pita"
      texto="Algo falló de nuestro lado, no del tuyo. Inténtalo de nuevo en un momento; si persiste, llámanos y lo resolvemos."
      accion={
        <button type="button" onClick={reset} className="estado-boton boton-juego">
          Reintentar
        </button>
      }
      pie={error.digest ? <p className="mt-4 text-micro text-texto-suave">Código para soporte: {error.digest}</p> : null}
    />
  )
}
