'use client'

import Link from 'next/link'
import { EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'

/**
 * Error de una página del panel. NUNCA muestra `error.message` (puede traer detalles
 * internos): solo el `digest`, que en el log del servidor lleva a la traza.
 */
export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Tarjeta>
      <EstadoPanel
        tono="malo"
        escena="error"
        titulo="Se nos rompió la vuelta"
        descripcion="Algo falló de nuestro lado al cargar esta sección, no de tu parte. Prueba otra vez; si sigue pasando, pásale este código a soporte."
        codigo={error.digest}
        accion={
          <>
            <button type="button" className="pn-boton pn-boton--primario" onClick={reset}>
              Intentar de nuevo
            </button>
            <Link className="pn-boton" href="/panel">
              Ir al resumen
            </Link>
          </>
        }
      />
    </Tarjeta>
  )
}
