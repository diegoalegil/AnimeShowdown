/**
 * Utilidades puras del Muro de Voces.
 * Módulo .js hermano (no componente) para no romper react-refresh:
 * los .jsx solo exportan componentes.
 */

/**
 * Espejo en JS del token global --ease-lift, para WAAPI
 * (element.animate no resuelve var() en la opción `easing`).
 */
export const EASE_LIFT_JS = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * Rotación determinista por id: hash estable -> grados en [-0.6, 0.6].
 * Pura: segura en el render (criterio 5 del brief — nada de Math.random).
 * @param {string|number} id — id estable de la voz
 * @returns {number} grados con 2 decimales
 */
export function stripRotation(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  const t = (((h % 1000) + 1000) % 1000) / 999 // 0..1 estable
  return Math.round((t * 1.2 - 0.6) * 100) / 100
}

/**
 * ¿El usuario pide motion reducido?
 * Llamar SOLO desde handlers/effects (lee estado del entorno).
 * @returns {boolean}
 */
export function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Vuelo FLIP con ghost por WAAPI (sin inyectar estilos: clase .vw-ghost
 * + keyframes de element.animate, transform/opacity únicamente).
 *
 * mode 'in'  — el ghost "nace" en `from` (el papel del composer) y aterriza
 *              exactamente en `to` (la tira real, oculta con data-inflight).
 * mode 'out' — el ghost parte de `from` (la tira) y vuela hacia `to`
 *              (el composer) desvaneciéndose: fallo de publicación.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.el — nodo a clonar como ghost
 * @param {{left:number,top:number,width:number,height:number}} opts.from
 * @param {{left:number,top:number,width:number,height:number}} opts.to
 * @param {'in'|'out'} [opts.mode]
 * @param {number} [opts.duration] — ms
 * @param {string} [opts.easing]
 * @param {number} [opts.rot] — rotación final (deg) de la tira, para que el
 *   papel gire a su sitio durante el vuelo
 * @param {() => void} [opts.onDone]
 * @returns {Animation|null}
 */
export function flyGhost({
  el,
  from,
  to,
  mode = 'in',
  duration = 400,
  easing = EASE_LIFT_JS,
  rot = 0,
  onDone,
}) {
  if (!el || !from || !to || typeof el.animate !== 'function') {
    if (onDone) onDone()
    return null
  }
  const ghost = el.cloneNode(true)
  ghost.classList.add('vw-ghost')
  ghost.removeAttribute('data-inflight')
  ghost.removeAttribute('data-enter')
  ghost.setAttribute('aria-hidden', 'true')

  const base = mode === 'in' ? to : from
  const other = mode === 'in' ? from : to
  ghost.style.left = base.left + 'px'
  ghost.style.top = base.top + 'px'
  ghost.style.width = base.width + 'px'
  ghost.style.height = base.height + 'px'
  document.body.appendChild(ghost)

  const dx = other.left - base.left
  const dy = other.top - base.top
  const sx = other.width / Math.max(base.width, 1)
  const sy = other.height / Math.max(base.height, 1)
  const away =
    'translate(' + dx + 'px, ' + dy + 'px) rotate(0deg) scale(' + sx + ', ' + sy + ')'
  const home = 'translate(0px, 0px) rotate(' + rot + 'deg) scale(1, 1)'

  const frames =
    mode === 'in'
      ? [
          { transform: away, opacity: 0.85 },
          { transform: home, opacity: 1 },
        ]
      : [
          { transform: home, opacity: 1 },
          { transform: away, opacity: 0.2 },
        ]

  const anim = ghost.animate(frames, { duration, easing, fill: 'forwards' })
  let settled = false
  const cleanup = () => {
    if (ghost.parentNode) ghost.parentNode.removeChild(ghost)
  }
  const settle = () => {
    if (settled) return
    settled = true
    cleanup()
    if (onDone) onDone()
  }
  anim.onfinish = settle
  anim.oncancel = () => {
    if (!settled) {
      settled = true
      cleanup()
    }
  }
  // Cinturón anti-throttling: si la pestaña se oculta a mitad de vuelo,
  // WAAPI se pausa y onfinish no llega; el muro NO puede quedarse con la
  // tira invisible. Pasado el tiempo del vuelo + margen, se asienta igual.
  setTimeout(() => {
    if (!settled) {
      try {
        anim.cancel()
      } catch {
        /* ya cancelada */
      }
      settle()
    }
  }, duration + 300)
  return anim
}
