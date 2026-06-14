// HeaderStandards.jsx — "Los estandartes del header"
// Patch por zonas para components/Header.jsx. Cuatro piezas exportadas:
//
//   <NavInkRail>        — la gota de tinta del nav desktop (SelectionRail horizontal)
//   <PaperDropdown>     — panel de papel (sustituye el shell del MoreMenu actual)
//   <NorenMobileMenu>   — el panel móvil como noren (dialog modal con focus trap)
//   useCondensedHeader  — condensación al scrollear SIN animar height
//
// Reglas de la casa respetadas: cero hex en JSX (tokens vía clases / var()),
// solo transform/opacity, WAAPI para coreografía puntual (CSP prohíbe inyectar
// <style>), keyframes/clases en index.css (ver header-standards.css), React 19
// + Compiler (sin refs en render, inicializadores puros), reduced-motion.
//
// INTOCABLES (no los envuelve ni los mueve este patch): RitoAvatarTarget (×2),
// NotifBell (#21), botón ⌘K / OPEN_COMMAND_PALETTE_EVENT. Ver handoff-notas.md.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotionPref } from '../hooks/useHeaderStandards'

// Easings de la casa. WAAPI no resuelve var(--ease-*), así que los valores
// van literales aquí; son los MISMOS cubic-bezier de index.css.
const EASE_BRUSH = 'cubic-bezier(0.65, 0.05, 0.36, 1)' // var(--ease-brush)
const EASE_STAMP = 'cubic-bezier(0.34, 1.56, 0.64, 1)' // overshoot de hanko

/**
 * NavInkRail — la gota de tinta bajo el item activo del nav desktop.
 *
 * Contrato con el host (Header.jsx, zona nav ≥1120px):
 *  - El <nav> lleva `position: relative` y `ref={containerRef}`.
 *  - Cada enlace de sección lleva `data-nav-key="personajes"` (key ESTABLE,
 *    no la ruta: sobrevive a i18n y a renombres de path).
 *  - `activeKey` se deriva de useLocation; en rutas sin item (fichas, /votar,
 *    grupo "Más") se pasa `null` y la gota se DESVANECE donde estaba.
 *
 * Coreografía: viaje FLIP entre posiciones medidas (translateX + estiramiento
 * scaleX, 180ms ease-brush); reaparición = estampado hanko (220ms overshoot);
 * desvanecido = opacity 180ms (transición CSS de .as-ink-drop). Resize y
 * cambios de set de items (logueado/invitado) se siguen con rAF coalescado
 * SIN viaje. reduced-motion: aparece en el destino, sin viaje.
 *
 * @param {{
 *   containerRef: React.RefObject<HTMLElement>,
 *   activeKey: string | null,
 *   width?: number,
 *   forceReduced?: boolean,
 * }} props
 */
export function NavInkRail({ containerRef, activeKey, width = 22, forceReduced = false }) {
  const dropRef = useRef(null)
  const posRef = useRef({ x: 0, visible: false })
  const frameRef = useRef(0)
  const reduced = useReducedMotionPref(forceReduced)
  const reducedRef = useRef(reduced)
  useEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  const apply = useCallback(
    (mode) => {
      const container = containerRef.current
      const drop = dropRef.current
      if (!container || !drop) return
      const el =
        activeKey == null
          ? null
          : container.querySelector(`[data-nav-key="${CSS.escape(activeKey)}"]`)
      const pos = posRef.current
      // Sin item (o item oculto por breakpoint): desvanecer DONDE ESTABA.
      // No movemos transform — la transición de opacity vive en .as-ink-drop.
      if (!el || el.offsetWidth === 0) {
        pos.visible = false
        drop.style.opacity = '0'
        return
      }
      const x = el.offsetLeft + el.offsetWidth / 2 - width / 2
      const from = pos.x
      const wasVisible = pos.visible
      pos.x = x
      pos.visible = true
      // Estilo final SIEMPRE síncrono y sin fill: la animación lo cubre y
      // muere sola — cero fugas de `fill: forwards` (recomendación WebKit).
      drop.style.transform = `translateX(${x}px)`
      drop.style.opacity = '1'
      if (reducedRef.current || mode === 'follow') return
      if (!wasVisible) {
        // Reaparición tras una ruta sin item: estampado en el destino.
        drop.animate(
          [
            { transform: `translateX(${x}px) translateY(-9px) scale(1.35)`, opacity: 0 },
            { transform: `translateX(${x}px) translateY(0) scale(1)`, opacity: 1 },
          ],
          { duration: 220, easing: EASE_STAMP },
        )
        return
      }
      if (from === x) return
      // Viaje: FLIP entre posiciones medidas. Estiramiento de tinta a mitad
      // de camino (scaleX 1.55 / scaleY 0.78) — solo transform.
      drop.animate(
        [
          { transform: `translateX(${from}px) scaleX(1)` },
          {
            transform: `translateX(${(from + x) / 2}px) scaleX(1.55) scaleY(0.78)`,
            offset: 0.5,
          },
          { transform: `translateX(${x}px) scaleX(1)` },
        ],
        { duration: 180, easing: EASE_BRUSH },
      )
    },
    [activeKey, containerRef, width],
  )

  // Cambio de activeKey → viaje (layout effect: medimos tras el commit,
  // antes del paint — la gota nunca pinta un frame en la posición vieja).
  useLayoutEffect(() => {
    apply('travel')
  }, [apply])

  // Resize del nav (viewport, fuentes, login/logout cambia el set de items):
  // seguir sin viaje, rAF coalescado.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const schedule = () => {
      if (frameRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0
        apply('follow')
      })
    }
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(container)
    }
    window.addEventListener('resize', schedule)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', schedule)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [apply, containerRef])

  return <span ref={dropRef} aria-hidden="true" className="as-ink-drop" style={{ width }} />
}

/**
 * PaperDropdown — panel de papel del nav (shell que sustituye al MoreMenu).
 *
 * Hover Y click coherentes: hover abre a los 150ms (intención), click FIJA
 * (pin) y reabre/cierra al instante; al salir de la zona (botón + panel
 * comparten un único wrapper que escucha pointerenter/leave) cierra con
 * 300ms de gracia — el camino diagonal del cursor nunca parpadea porque
 * salir del botón hacia el panel no abandona la zona, y salir de la zona
 * solo arma un timer que re-entrar cancela.
 *
 * Teclado: Enter/Espacio/↓ abren y enfocan el primer item; ↑↓ ciclan,
 * Home/End saltan, Esc cierra y devuelve el foco al botón, Tab cierra y
 * sigue su curso. ARIA: aria-haspopup + aria-expanded en el botón,
 * role="menu" en el panel; los hijos deben llevar role="menuitem"
 * (los AppNavLink actuales del MoreMenu, tal cual, + role).
 *
 * Animación de apertura: clase .as-paper-panel (scaleY 0.96→1 + opacity,
 * 180ms ease-brush, keyframes en index.css). El cierre desmonta en seco:
 * un panel que se repliega retiene al usuario 180ms sin aportar lectura.
 *
 * @param {{
 *   label: React.ReactNode,        — contenido del botón (texto + chevron del host)
 *   isActive?: boolean,            — tinta el botón si la ruta activa vive en el grupo
 *   buttonClassName?: (state: { open: boolean, isActive: boolean }) => string,
 *   panelClassName?: string,
 *   onOpenChange?: (open: boolean) => void,  — hook para play('playClick')
 *   children: React.ReactNode,     — items con role="menuitem"
 * }} props
 */
export function PaperDropdown({
  label,
  isActive = false,
  buttonClassName,
  panelClassName = '',
  onOpenChange,
  children,
}) {
  const [open, setOpen] = useState(false)
  const zoneRef = useRef(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const pinnedRef = useRef(false)
  const timersRef = useRef({ open: 0, close: 0 })

  const setOpenNotify = useCallback(
    (next) => {
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const clearTimer = (key) => {
    const t = timersRef.current
    if (t[key]) {
      window.clearTimeout(t[key])
      t[key] = 0
    }
  }

  const close = useCallback(
    (refocus = false) => {
      pinnedRef.current = false
      clearTimer('open')
      clearTimer('close')
      setOpenNotify(false)
      if (refocus) btnRef.current?.focus()
    },
    [setOpenNotify],
  )

  // Hover-intent: solo puntero mouse (touch va por click).
  const onZoneEnter = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimer('close')
    if (open || timersRef.current.open) return
    timersRef.current.open = window.setTimeout(() => {
      timersRef.current.open = 0
      setOpenNotify(true)
    }, 150)
  }
  const onZoneLeave = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimer('open')
    if (!open || pinnedRef.current) return
    clearTimer('close')
    timersRef.current.close = window.setTimeout(() => {
      timersRef.current.close = 0
      setOpenNotify(false)
    }, 300)
  }

  const onButtonClick = () => {
    clearTimer('open')
    clearTimer('close')
    if (open && pinnedRef.current) {
      close()
      return
    }
    pinnedRef.current = true
    setOpenNotify(true)
  }

  const menuItems = () =>
    panelRef.current ? [...panelRef.current.querySelectorAll('[role="menuitem"]')] : []

  const onButtonKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      pinnedRef.current = true
      setOpenNotify(true)
      requestAnimationFrame(() => menuItems()[0]?.focus())
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      close(true)
    }
  }

  // Activar un item cierra el panel (comportamiento de menú estándar): el
  // onClick propio del item (sonido + navegación) corre primero por bubbling.
  const onPanelClick = (e) => {
    if (e.target.closest('[role="menuitem"]')) close()
  }

  const onPanelKeyDown = (e) => {
    const items = menuItems()
    const i = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'Tab') {
      close()
    }
  }

  // Click fuera cierra el pin (mismo patrón que el MoreMenu actual).
  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (zoneRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, close])

  useEffect(
    () => () => {
      clearTimer('open')
      clearTimer('close')
    },
    [],
  )

  return (
    <div
      ref={zoneRef}
      className="relative"
      onPointerEnter={onZoneEnter}
      onPointerLeave={onZoneLeave}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={onButtonClick}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="true"
        aria-expanded={open}
        className={buttonClassName ? buttonClassName({ open, isActive }) : undefined}
      >
        {label}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          onKeyDown={onPanelKeyDown}
          onClick={onPanelClick}
          className={`as-paper-panel ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * NorenMobileMenu — el menú móvil como noren que cae desde arriba.
 *
 * Dialog modal de verdad: scroll-lock del body, foco al primer item al abrir,
 * trap de Tab, Esc cierra y devuelve el foco al hamburguesa. SIEMPRE montado
 * (la tela existe, solo se levanta): apertura/cierre = translateY −100%→0
 * (320ms ease-lift) + scrim plano en opacity — cero mount-cost en el tap y
 * visibility con delay para que el panel cerrado no robe foco ni hit-test.
 * Las tablillas hacen stagger de 40ms vía --noren-i (clases en index.css).
 * reduced-motion: el noren entra/sale por fade (lo resuelve el CSS).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,             — el host hace setMobileOpen(false)
 *   toggleRef: React.RefObject<HTMLElement>,  — botón hamburguesa (retorno de foco)
 *   label?: string,
 *   id?: string,                      — para aria-controls del hamburguesa
 *   children: React.ReactNode,        — <NorenTablilla> con el contenido actual
 * }} props
 */
export function NorenMobileMenu({
  open,
  onClose,
  toggleRef,
  label = 'Menú de navegación',
  id = 'mobile-nav-noren',
  children,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector('a, button, [tabindex]:not([tabindex="-1"])')
        ?.focus()
    }, 80)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        toggleRef?.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll(
        'a, button, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, toggleRef])

  return (
    <div
      className="as-noren-layer"
      data-open={open || undefined}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Cerrar menú"
        onClick={onClose}
        className="as-noren-scrim"
      />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="as-noren-panel"
      >
        {children}
      </div>
    </div>
  )
}

/** Tablilla del noren: fija el índice de stagger (40ms por ítem). */
export function NorenTablilla({ index = 0, className = '', children }) {
  return (
    <div className={`as-noren-tablilla ${className}`} style={{ '--noren-i': index }}>
      {children}
    </div>
  )
}

// useReducedMotionPref y useCondensedHeader viven en
// src/hooks/useHeaderStandards.js (la regla react-refresh/only-export-components
// exige que este .jsx solo exporte componentes).
