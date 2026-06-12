/* Boot del modo calma (la linterna del dojo): pone html.as-calm ANTES del
   primer paint para que no haya flash de animaciones. Vive como script
   clásico bloqueante en <head> porque la CSP del sitio no permite inline
   scripts ('self' sin hashes). La clave es la misma que usa
   src/lib/calm-mode.js — si cambia allí, cambia aquí. */
;(function () {
  try {
    if (localStorage.getItem('animeshowdown.calm') === 'true') {
      document.documentElement.classList.add('as-calm')
    }
  } catch {
    /* storage bloqueado: arranque normal */
  }
})()
