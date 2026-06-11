import { Link, NavLink, useHref, useNavigate } from 'react-router-dom'
import { startNavigationViewTransition, supportsViewTransitions } from '../lib/viewTransitions'

// Link/NavLink con view transition para las superficies calientes de
// navegación (nav del shell, cartas de personaje, ranking, CTAs de la home).
// En el modo declarativo de react-router la prop `viewTransition` es inerte
// (solo el data router llama a startViewTransition), así que aquí se
// intercepta el click y se envuelve la navegación con la lib propia. En
// navegadores sin soporte, con reduced motion o en clicks modificados
// (cmd/ctrl, botón central, target) el Link se comporta exactamente igual
// que el de react-router.
//
// `onViewTransitionStart` se invoca SOLO cuando todos los guards pasan,
// justo antes de iniciar la transición: es el sitio para marcar el origen
// de un morph (view-transition-name). En el onClick del consumidor la
// marca se pondría también en clicks modificados (cmd/ctrl/shift, pestaña
// nueva), donde no hay transición que la limpie, y la siguiente navegación
// arrastraría un morph fantasma desde la carta marcada.

function esClickDeNavegacion(event, target) {
  return (
    event.button === 0 &&
    (!target || target === '_self') &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

function useViewTransitionClick({ to, replace, state, target, onClick, onViewTransitionStart }) {
  const navigate = useNavigate()
  const href = useHref(to)

  return (event) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (!supportsViewTransitions()) return
    if (!esClickDeNavegacion(event, target)) return
    // Solo transiciona cuando cambia el pathname: el settle de App.jsx se
    // engancha al commit por pathname, y un cambio solo de query (tabs,
    // filtros) ni siquiera es un cambio de página que merezca transición.
    if (href.split(/[?#]/)[0] === window.location.pathname) return

    event.preventDefault()
    onViewTransitionStart?.()
    startNavigationViewTransition(() => navigate(to, { replace, state }))
  }
}

export function AppLink({ to, replace, state, target, onClick, onViewTransitionStart, ...rest }) {
  const handleClick = useViewTransitionClick({ to, replace, state, target, onClick, onViewTransitionStart })
  return <Link to={to} replace={replace} state={state} target={target} onClick={handleClick} {...rest} />
}

export function AppNavLink({ to, replace, state, target, onClick, onViewTransitionStart, ...rest }) {
  const handleClick = useViewTransitionClick({ to, replace, state, target, onClick, onViewTransitionStart })
  return <NavLink to={to} replace={replace} state={state} target={target} onClick={handleClick} {...rest} />
}
