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

function useViewTransitionClick({ to, replace, state, target, onClick }) {
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
    startNavigationViewTransition(() => navigate(to, { replace, state }))
  }
}

export function AppLink({ to, replace, state, target, onClick, ...rest }) {
  const handleClick = useViewTransitionClick({ to, replace, state, target, onClick })
  return <Link to={to} replace={replace} state={state} target={target} onClick={handleClick} {...rest} />
}

export function AppNavLink({ to, replace, state, target, onClick, ...rest }) {
  const handleClick = useViewTransitionClick({ to, replace, state, target, onClick })
  return <NavLink to={to} replace={replace} state={state} target={target} onClick={handleClick} {...rest} />
}
