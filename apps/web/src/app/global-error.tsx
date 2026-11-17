'use client'

/** Último recurso si falla el layout raíz. Sin detalles internos. */
export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-CO">
      <body>
        <main>
          <h1>Algo salió mal</h1>
          {error.digest ? <p>Código para soporte: {error.digest}</p> : null}
          <button type="button" onClick={reset}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  )
}
