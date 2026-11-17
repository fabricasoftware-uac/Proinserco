'use client'

/**
 * Error de una ruta. NUNCA muestra `error.message` (puede traer detalles
 * internos): solo el `digest`, que en el log del servidor lleva a la traza.
 * El componente no se llama `Error` para no ensombrecer el constructor global.
 */
export default function PaginaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <h1>Algo salió mal</h1>
      <p>Inténtalo de nuevo en un momento.</p>
      {error.digest ? <p>Código para soporte: {error.digest}</p> : null}
      <button type="button" onClick={reset}>
        Reintentar
      </button>
    </main>
  )
}
