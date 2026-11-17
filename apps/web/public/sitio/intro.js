/*
 * Arranque del sitio público ANTES del primer pintado (script externo con nonce:
 * nada en línea). Escribe en <html>:
 *  - data-anim='si'   → hay movimiento: el CSS aplica los estados iniciales.
 *  - data-intro='si'  → primera visita de la sesión: se muestra el loader
 *                       (con movimiento reducido, su versión corta de fundido).
 * Sin JS no se escribe nada y el sitio se ve completo y estático.
 * Red de seguridad: a los 9 s se retira todo lo que nadie haya reclamado.
 */
;(() => {
  var h = document.documentElement
  try {
    var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducido) h.dataset.anim = 'si'
    var visto = '1'
    try {
      visto = sessionStorage.getItem('proinserco-intro')
    } catch (e) {}
    if (visto !== '1') {
      h.dataset.intro = 'si'
      try {
        sessionStorage.setItem('proinserco-intro', '1')
      } catch (e) {}
    }
    window.setTimeout(() => {
      if (h.dataset.intro === 'si' && !document.querySelector('[data-loader][data-activa]')) h.dataset.intro = 'no'
      if (h.dataset.anim === 'si') h.dataset.anim = 'no'
    }, 9000)
  } catch (e) {}
})()
