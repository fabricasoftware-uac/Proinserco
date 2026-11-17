'use client'

import { CLAVE_TEMA } from '@proinserco/tokens'

/**
 * Script ANTI-PARPADEO del tema del panel. En línea y bloqueante: fija
 * <html data-tema> antes del primer pintado. Lo autoriza el NONCE de la CSP
 * (las rutas del panel y de acceso son dinámicas). Contenido constante: no
 * interpola nada que venga del usuario.
 *
 * React 19 avisa ("Encountered a script tag while rendering") si un <script>
 * se renderiza en el cliente. Por eso solo se emite en el render de servidor
 * (HTML inicial, donde sí se ejecuta); en el cliente devuelve null y
 * `suppressHydrationWarning` evita el aviso de hidratación (el navegador
 * oculta el valor del nonce). Tras el primer pintado el tema lo gestiona el
 * proveedor de tema, así que no hace falta volver a ejecutarlo.
 */
const CODIGO = `(function(){try{var t=localStorage.getItem('${CLAVE_TEMA}');if(t!=='claro'&&t!=='oscuro'){t=matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro'}document.documentElement.dataset.tema=t}catch(e){document.documentElement.dataset.tema='claro'}})()`

type Props = { nonce: string | undefined }

export function ScriptTema({ nonce }: Props) {
  if (typeof window !== 'undefined') return null
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: código constante autorizado por nonce, sin datos del usuario.
    <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CODIGO }} />
  )
}
