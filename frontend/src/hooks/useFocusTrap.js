import { useEffect, useRef } from 'react'
import { FOCUSABLE_SELECTOR } from '../lib/focusables'

/**
 * Focus-trap accesible para overlays modales A MEDIDA (ScoreScroll,
 * DuelCeremony…) que NO usan AccessibleDialog: tienen su propia coreografía y
 * piel, y envolverlos en el diálogo shōji (con su chrome y sus puertas
 * correderas) rompería el visual. Este hook les da el contrato WAI-ARIA de un
 * `dialog` SIN tocar la pintura:
 *
 * <ul>
 *   <li>Trap de Tab/Shift+Tab dentro de `dialogRef` (no se fuga a links del
 *       fondo).</li>
 *   <li>Escape → onClose.</li>
 *   <li>Foco inicial en `initialFocusRef` (o el primer focusable del overlay,
 *       o el propio contenedor) al abrir.</li>
 *   <li>Restaura el foco al elemento que lo tenía antes de abrir, al cerrar —
 *       y solo si el foco sigue dentro del overlay (no lo roba si otra vista
 *       ya lo tomó).</li>
 *   <li>Bloquea el scroll del body mientras está abierto (LIFO sin fugas:
 *       cada instancia salva/restaura su overflow previo).</li>
 * </ul>
 *
 * <p>A diferencia de AccessibleDialog (que se portaliza a {@code document.body}
 * e inertiza {@code #root}), estos overlays renderizan inline en el árbol de la
 * app, así que NO pueden inertizar su propio ancestro; el contrato es
 * {@code aria-modal="true"} + el trap + scroll-lock (mismo patrón que
 * CardShowcase, el otro modal a medida de la app).
 *
 * <p>`onClose` se lee desde una ref interna: un re-render del padre (p. ej. un
 * estado isPending) no reinicia el ciclo ni vuelve a robar el foco.
 *
 * @param {import('react').RefObject<HTMLElement>} dialogRef — contenedor del overlay.
 * @param {object} [opts]
 * @param {boolean} [opts.open=true] — si el overlay está montado/visible. El
 *        ciclo se arma al pasar a true y se limpia (restaurando todo) al salir.
 * @param {() => void} [opts.onClose] — invocado en Escape.
 * @param {import('react').RefObject<HTMLElement>} [opts.initialFocusRef] —
 *        elemento a enfocar al abrir; si falta, el primer focusable.
 */
export function useFocusTrap(dialogRef, { open = true, onClose, initialFocusRef } = {}) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    if (!dialog) return undefined

    // Trigger: quien tenía el foco antes de abrir, para devolvérselo al cerrar.
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const enfocables = () =>
      Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      )

    // Foco inicial: el ref pedido, si no el primer focusable, si no el panel.
    const inicial = initialFocusRef?.current
    if (inicial instanceof HTMLElement) {
      inicial.focus()
    } else {
      const primero = enfocables()[0]
      if (primero instanceof HTMLElement) primero.focus()
      else if (typeof dialog.focus === 'function') dialog.focus()
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = enfocables()
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowPrevio
      if (trigger && typeof trigger.focus === 'function') {
        const activo = document.activeElement
        const nuestro =
          activo === null || activo === document.body || dialog.contains(activo)
        if (nuestro) trigger.focus()
      }
    }
    // initialFocusRef/onClose se leen por ref; dialogRef es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

export default useFocusTrap
