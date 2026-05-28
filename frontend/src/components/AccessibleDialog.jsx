import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Diálogo modal accesible reutilizable.
 *
 * <p>Antes la app tenía 3+ modales custom (filtros móvil de Personajes,
 * límite anónimo de Votar, borrar cuenta de Perfil) cada uno implementando
 * su propio markup. Todos sufrían los mismos problemas:
 * <ul>
 *   <li>Sin focus trap → Tab salía a links del fondo</li>
 *   <li>Sin Escape → solo se cerraba clicando el botón</li>
 *   <li>Sin foco inicial al abrir → lector empezaba en sitio arbitrario</li>
 *   <li>Sin restore del foco al cerrar → el botón que abrió quedaba huérfano</li>
 *   <li>Sin bloqueo de scroll del body → fondo seguía scrolleando</li>
 *   <li>role=dialog pero sin aria-modal + aria-labelledby completos</li>
 * </ul>
 *
 * <p>Este componente centraliza la solución:
 * <ul>
 *   <li>Portal al document.body — escapa de overflow/transform ancestrales</li>
 *   <li>aria-modal="true" + role="dialog" + aria-labelledby={titleId}</li>
 *   <li>Focus inicial en el primer elemento focusable del contenido (o el
 *       botón Cerrar si no hay otro)</li>
 *   <li>Trap de Tab: Tab desde el último elemento → primero, Shift+Tab
 *       desde el primero → último</li>
 *   <li>Escape cierra y restaura foco al trigger (el elemento que tenía
 *       foco antes de open=true)</li>
 *   <li>Click en backdrop cierra si {@code closeOnBackdrop} es true (default)</li>
 *   <li>document.body.overflow = "hidden" mientras abierto</li>
 *   <li>inert sobre el resto del DOM (cuando el browser lo soporta) para
 *       que lectores no naveguen contenido bajo el modal</li>
 * </ul>
 *
 * <p>Uso:
 * <pre>
 *   const [open, setOpen] = useState(false)
 *   return (
 *     &lt;>
 *       &lt;button onClick={() => setOpen(true)}>Borrar cuenta&lt;/button>
 *       &lt;AccessibleDialog
 *         open={open}
 *         onClose={() => setOpen(false)}
 *         titleId="borrar-cuenta-title"
 *         label="Confirmar borrado de cuenta"
 *       >
 *         &lt;h2 id="borrar-cuenta-title">¿Seguro?&lt;/h2>
 *         ...
 *       &lt;/AccessibleDialog>
 *     &lt;/>
 *   )
 * </pre>
 */
function AccessibleDialog({
  open,
  onClose,
  titleId,
  label,
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
  className = '',
  panelClassName = '',
  // align controla cómo se posiciona el panel dentro del backdrop:
  //   'center'  — clásico modal centrado vertical+horizontal (default)
  //   'bottom'  — bottom-sheet móvil, panel ancho fondo
  //   'top'     — sheet desde arriba (raro pero válido p.ej. notificación)
  align = 'center',
}) {
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)

  // Guardar el elemento focusable que tenía el foco antes de abrir el modal.
  // Al cerrar, devolvemos el foco ahí — esencial para flujos de teclado
  // (Tab desde un botón, abre modal, cierras, vuelves al botón).
  useEffect(() => {
    if (!open) return undefined
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      const trigger = triggerRef.current
      if (trigger && typeof trigger.focus === 'function') {
        // setTimeout para que React termine de unmounting el modal antes de
        // mover el foco — sin esto algunas combinaciones Tab/Enter saltan.
        setTimeout(() => trigger.focus(), 0)
      }
    }
  }, [open])

  // Lock del scroll del body mientras open. Usamos overflow:hidden — más
  // robusto que position:fixed con top negativo (que rompe scroll position
  // restore al cerrar). Guardamos el overflow previo para restaurarlo.
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // inert + aria-hidden sobre el árbol de la app mientras el modal está
  // abierto. El diálogo se portaliza a document.body (hermano de #root), así
  // que inertizar #root saca del tab-order y del árbol accesible TODO el
  // contenido de fondo sin tocar el modal. Esto cumple lo prometido en el
  // docblock: lectores de pantalla no navegan el contenido bajo el modal y
  // Tab no puede salirse hacia él (defensa en profundidad sobre el focus
  // trap). El foco vive dentro del portal, no bajo #root, así que poner
  // aria-hidden en #root no oculta el elemento enfocado (sin violación a11y).
  // inert es no-op en navegadores que no lo soportan (Safari <15.5), igual
  // que dice el docblock ("cuando el browser lo soporta").
  // Guardamos/restauramos el valor previo para soportar diálogos apilados
  // (cierre LIFO restaura el estado correcto en cada nivel).
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined
    const appRoot = document.getElementById('root')
    if (!appRoot) return undefined
    const previaInert = appRoot.inert
    const previaAriaHidden = appRoot.getAttribute('aria-hidden')
    appRoot.inert = true
    appRoot.setAttribute('aria-hidden', 'true')
    return () => {
      appRoot.inert = previaInert
      if (previaAriaHidden === null) {
        appRoot.removeAttribute('aria-hidden')
      } else {
        appRoot.setAttribute('aria-hidden', previaAriaHidden)
      }
    }
  }, [open])

  // Focus inicial al primer elemento focusable dentro del diálogo. Si no
  // hay ninguno, focuseamos el panel (que tiene tabIndex=-1) para que el
  // lector empiece a leer su contenido.
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const focusables = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
    const first = focusables[0]
    if (first instanceof HTMLElement) {
      first.focus()
    } else {
      dialogRef.current.focus()
    }
  }, [open])

  // Trap de Tab + Escape close. Listener al document para que funcione
  // aunque el foco esté en un input dentro del modal.
  const onKeyDown = useCallback(
    (e) => {
      if (!open || !dialogRef.current) return
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [open, onClose, closeOnEscape],
  )

  useEffect(() => {
    if (!open) return undefined
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onKeyDown])

  if (!open || typeof document === 'undefined') return null

  // Alineación del backdrop. center = centrado. bottom = sheet pegado abajo.
  const alignClass =
    align === 'bottom'
      ? 'items-end justify-center p-0'
      : align === 'top'
        ? 'items-start justify-center p-0'
        : 'items-center justify-center p-4'

  // Estilo del panel según align. bottom-sheet ocupa todo el ancho con
  // bordes redondeados solo arriba.
  const defaultPanelByAlign =
    align === 'bottom'
      ? 'w-full max-w-none rounded-2xl rounded-b-none border-x-0 border-b-0'
      : align === 'top'
        ? 'w-full max-w-none rounded-2xl rounded-t-none border-x-0 border-t-0'
        : 'w-full max-w-md rounded-2xl'

  return createPortal(
    <div
      // Backdrop. role=presentation y onClick controlado para closeOnBackdrop.
      role="presentation"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.()
      }}
      className={`fixed inset-0 z-[100] flex bg-black/70 backdrop-blur-sm ${alignClass} ${className}`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : label}
        tabIndex={-1}
        className={`relative max-h-[90vh] max-h-[calc(100dvh_-_env(safe-area-inset-top))] overflow-y-auto border border-border bg-surface p-6 shadow-2xl focus:outline-none ${defaultPanelByAlign} ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Selector para elementos focusables dentro del modal. Cubre los casos
// estándar de WAI-ARIA: links con href, botones no disabled, inputs/select/
// textarea no disabled, [tabindex>=0] explícitos, y contenteditable.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export default AccessibleDialog
