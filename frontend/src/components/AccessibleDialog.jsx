import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOCUSABLE_SELECTOR } from '../lib/focusables'
import './shoji-dialog.css'

/* Registro module-level de dialogos abiertos, por orden de apertura (NOTAS
   shoji §3). El superior lleva el scrim mas oscuro; los de debajo se atenuan.
   El cierre es LIFO porque el foco vive en el superior. El registro se limpia
   en el cleanup del efecto, asi una navegacion brusca no deja entradas zombi.
   El z-order lo da el orden DOM de los portals a document.body. */
const shojiStack = []
function notifyShojiStack() {
  shojiStack.forEach((entry, i) => {
    entry.update({
      dimmed: i < shojiStack.length - 1,
      stacked: i > 0,
    })
  })
}

/** Coordenadas de entorno (puras — seguras bajo StrictMode/SSR). */
function isSheetViewport() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 639px)').matches
  )
}
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

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
 * <p>PIEL "puertas shōji" (horneada, aditiva, sin cambiar la API): el
 * backdrop pinta un scrim plano 75% sin blur; el panel se envuelve en un
 * marco kumiko y, al abrir, dos hojas decorativas que lo cubrían se retiran
 * (280ms) revelando los children ya colocados. Al cerrar las hojas vuelven
 * (200ms) y el diálogo se desmonta (~300ms total). Las hojas y el marco son
 * decorativos (aria-hidden, fuera del focus-trap, pointer-events:none). El
 * CONTRATO a11y es independiente de la coreografía: cuando open pasa a false
 * la limpieza a11y (restore de foco, quitar inert/aria-hidden de #root,
 * restaurar scroll) corre de inmediato — el fondo es usable al instante — y
 * solo el DESMONTE VISUAL se difiere durante la fase de cierre, con el panel
 * aria-hidden y sin capturar eventos. prefers-reduced-motion ⇒ fade plano,
 * sin hojas y con desmonte casi inmediato.
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
  //   'bottom'  — bottom-sheet móvil, panel ancho fondo (coreografía vertical)
  //   'top'     — panel anclado arriba (coreografía de hojas, no sheet vertical)
  align = 'center',
}) {
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)
  const restoreTimerRef = useRef(null) // restore de foco diferido (cancelable en reapertura)
  const entryRef = useRef(null) // entrada de este diálogo en shojiStack (LIFO de Escape)

  // Máquina de fases del DESMONTE VISUAL, independiente del contrato a11y:
  //   open=true               → phase 'open', diálogo activo (a11y vivo).
  //   open=false (estaba open) → phase 'closing', a11y YA limpio (corre con
  //                              open), las hojas vuelven y el panel queda
  //                              inerte; tras closeMs → 'closed' (desmonta).
  // Los efectos a11y siguen colgando del PROP open (no de phase), así su
  // cleanup dispara en cuanto open pasa a false: el fondo es usable al
  // instante y nunca queda un diálogo zombi atrapando foco o anunciándose.
  const [phase, setPhase] = useState(open ? 'open' : 'closed')
  const [stackState, setStackState] = useState({ dimmed: false, stacked: false })
  const [sheet, setSheet] = useState(isSheetViewport)
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)

  // align='bottom' fuerza sheet aunque el viewport sea ancho (lo pide el
  // consumidor); en center/top el sheet solo aplica en móvil.
  const isSheet = align === 'bottom' || (sheet && align === 'center')
  const closeMs = reducedMotion ? 0 : isSheet ? 240 : 300
  // closeMs congelado en ref (escrito en effect, no en render): el timer de
  // cierre usa el deadline del MOMENTO de entrar en 'closing'; un cambio de
  // viewport/reduced-motion a mitad de cierre no debe reiniciarlo.
  const closeMsRef = useRef(closeMs)
  useEffect(() => {
    closeMsRef.current = closeMs
  }, [closeMs])

  // Ajuste-en-render con guard (React 19 / Compiler): sincroniza la fase con
  // el prop open SIN setState en cuerpo de efecto. Abrir (o reabrir en mitad
  // del cierre) es inmediato; cerrar entra en 'closing'. El timer que cierra
  // del todo vive en su propio efecto. El guard evita el bucle de render.
  if (open && phase !== 'open') {
    setPhase('open')
  } else if (!open && phase === 'open') {
    setPhase('closing')
  }

  // Fase de cierre → desmonte tras la coreografía. setState SOLO en el
  // callback del timer (nunca síncrono en cuerpo de efecto). Si closeMs es 0
  // (reduced-motion) el desmonte es prácticamente inmediato.
  useEffect(() => {
    if (phase !== 'closing') return undefined
    // Lee closeMsRef (no closeMs en deps): el deadline se fija al iniciar el
    // cierre y no se reinicia si el viewport oscila durante la coreografía.
    const t = setTimeout(() => setPhase('closed'), closeMsRef.current)
    return () => clearTimeout(t)
  }, [phase])

  // Viewport (sheet) + reduced-motion, con listener. setState SOLO en
  // callbacks del listener (no en cuerpo de efecto).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const mqs = window.matchMedia('(max-width: 639px)')
    const mqr = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onS = () => setSheet(mqs.matches)
    const onR = () => setReducedMotion(mqr.matches)
    mqs.addEventListener('change', onS)
    mqr.addEventListener('change', onR)
    return () => {
      mqs.removeEventListener('change', onS)
      mqr.removeEventListener('change', onR)
    }
  }, [])

  // ============ CONTRATO A11Y — todo colgado del PROP open ============
  // (limpieza inmediata al pasar open a false; phase NO interviene aquí)

  // Guardar el elemento focusable que tenía el foco antes de abrir el modal.
  // Al cerrar, devolvemos el foco ahí — esencial para flujos de teclado
  // (Tab desde un botón, abre modal, cierras, vuelves al botón).
  useEffect(() => {
    if (!open) return undefined
    // Cancela un restore pendiente de un cierre anterior (reapertura rápida o
    // re-setup de StrictMode): si no, su macrotask robaría el foco del diálogo
    // que se acaba de reabrir, sacándolo al fondo (que además está inert).
    if (restoreTimerRef.current !== null) {
      clearTimeout(restoreTimerRef.current)
      restoreTimerRef.current = null
    }
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panelNode = dialogRef.current // capturado en setup (estable hasta el cierre)
    return () => {
      const trigger = triggerRef.current
      if (!trigger || typeof trigger.focus !== 'function') return
      // Diferido a un macrotask: el restore debe correr DESPUÉS de que los demás
      // cleanups [open] hayan quitado el inert de #root (el trigger vive en
      // #root; con #root aún inert, trigger.focus() sería bloqueado). Guard "el
      // foco sigue siendo nuestro": restauramos solo si quedó suelto (body/null)
      // o aún dentro del panel que se cierra; si otra vista ya tomó el foco
      // (navegación de ruta) NO lo robamos. Cancelable en reapertura.
      restoreTimerRef.current = setTimeout(() => {
        restoreTimerRef.current = null
        const active = document.activeElement
        const ours =
          active === null ||
          active === document.body ||
          (panelNode instanceof HTMLElement && panelNode.contains(active))
        if (ours) trigger.focus()
      }, 0)
    }
  }, [open])

  // Lock del scroll del body mientras open. Usamos overflow:hidden — más
  // robusto que position:fixed con top negativo (que rompe scroll position
  // restore al cerrar). Guardamos el overflow previo para restaurarlo (cada
  // instancia salva/restaura el suyo → stack LIFO sin fugas).
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
    // Inertizamos el fondo: #root (la app) Y los backdrops de OTROS diálogos
    // shōji (apilados): como cada portal es hermano de #root, inertizar solo
    // #root dejaría el diálogo inferior enfocable y el trap del superior se
    // fugaría hacia él. Se excluye el propio backdrop de este diálogo. NO se
    // tocan otros portales (toasts) — solo app + diálogos. Save/restore por
    // nodo ⇒ el cierre LIFO devuelve cada nivel a su estado previo correcto.
    const self = dialogRef.current?.parentElement // backdrop de este portal
    const targets = [
      document.getElementById('root'),
      ...document.querySelectorAll('.as-shoji'),
    ].filter((el) => el instanceof HTMLElement && el !== self)
    if (targets.length === 0) return undefined
    const saved = targets.map((el) => ({
      el,
      inert: el.inert,
      ariaHidden: el.getAttribute('aria-hidden'),
    }))
    targets.forEach((el) => {
      el.inert = true
      el.setAttribute('aria-hidden', 'true')
    })
    return () => {
      saved.forEach(({ el, inert, ariaHidden }) => {
        el.inert = inert
        if (ariaHidden === null) el.removeAttribute('aria-hidden')
        else el.setAttribute('aria-hidden', ariaHidden)
      })
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
        // LIFO: solo el diálogo SUPERIOR (último del stack) responde a Escape.
        // stopPropagation no basta (los listeners hermanos cuelgan del MISMO
        // document) → stopImmediatePropagation corta también a los de debajo.
        const top = shojiStack[shojiStack.length - 1]
        if (top && entryRef.current && top !== entryRef.current) return
        e.preventDefault()
        e.stopImmediatePropagation()
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

  // Registro en el stack global de la piel shōji. Cuelga de `mounted` (la
  // ventana en que existe DOM): el scrim del superior se oscurece y los de
  // debajo se atenúan; el registro se limpia en el cleanup (sin zombis).
  const mounted = phase !== 'closed'
  useEffect(() => {
    if (!mounted) return undefined
    const entry = { update: setStackState }
    entryRef.current = entry // identidad de este diálogo para el LIFO de Escape
    shojiStack.push(entry)
    notifyShojiStack()
    return () => {
      const i = shojiStack.indexOf(entry)
      if (i !== -1) shojiStack.splice(i, 1)
      entryRef.current = null
      notifyShojiStack()
    }
  }, [mounted])

  if (!mounted || typeof document === 'undefined') return null

  const closing = phase === 'closing'

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

  // Clases de la piel shōji en el backdrop (decorativas + estado del stack).
  const shojiBackdropClass = [
    'as-shoji',
    reducedMotion && 'as-shoji--rm',
    isSheet && 'as-shoji--sheet',
    closing && 'as-shoji--closing',
    stackState.dimmed && 'as-shoji--dimmed',
    stackState.stacked && 'as-shoji--stacked',
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div
      // Backdrop. role=presentation y onClick controlado para closeOnBackdrop.
      // Durante el cierre no debe cerrar de nuevo (el panel ya es inerte).
      role="presentation"
      onClick={(e) => {
        if (!closing && closeOnBackdrop && e.target === e.currentTarget) onClose?.()
      }}
      className={`fixed inset-0 z-[100] flex ${alignClass} ${shojiBackdropClass} ${className}`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : label}
        // Durante el cierre el diálogo ya no atrapa foco ni se anuncia (el
        // contrato a11y ya se limpió al pasar open=false): lo marcamos
        // aria-hidden y sin capturar eventos para que sea puro adorno mientras
        // las hojas vuelven, antes del desmonte.
        aria-hidden={closing ? 'true' : undefined}
        tabIndex={-1}
        className={`as-shoji-shell relative border border-border bg-surface p-6 shadow-2xl focus:outline-none ${defaultPanelByAlign} ${panelClassName} ${closing ? 'pointer-events-none' : ''}`}
      >
        {/* El SCROLL vive en un wrapper interno (no en el shell): así el shell
            es el bloque contenedor NO scrolleable al que se anclan las hojas
            (absolute inset:0), que de otro modo se desplazarían con el contenido
            en paneles altos. El padding queda en el shell (controlable por el
            panelClassName del consumidor: un p-0 lo sigue anulando). Children
            del consumidor SIN envolver su superficie. Las hojas shōji son capa
            decorativa (aria-hidden, fuera del focus-trap, pointer-events:none
            una vez retiradas) que cubre el panel y se retira al abrir. */}
        <div className="max-h-[90vh] max-h-[calc(100dvh_-_env(safe-area-inset-top))] overflow-y-auto">
          {children}
        </div>
        <div className="as-shoji-leaves" aria-hidden="true">
          <div className="as-shoji-leaf as-shoji-leaf--l"><i className="as-shoji-edge"></i></div>
          <div className="as-shoji-leaf as-shoji-leaf--r"><i className="as-shoji-edge"></i></div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default AccessibleDialog
