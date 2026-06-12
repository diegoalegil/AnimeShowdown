import { Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { SEASONAL_EVENTS, eventoVisible } from './seasonal-events'

/**
 * Monta las capas estacionales activas. Sustituye al <SakuraPetals />
 * directo de App.jsx — un único punto de montaje para todas las
 * temporadas; los gates (fechas, kill-switches, rutas) viven en
 * seasonal-events.js.
 *
 * <p>prefers-reduced-motion se respeta DENTRO de cada capa (cada una
 * decide su degradación: el hanami se oculta, los tanzaku quedan
 * estáticos pero presentes).
 */
function SeasonalLayer() {
  const { pathname } = useLocation()
  const visibles = SEASONAL_EVENTS.filter((evento) => eventoVisible(evento, pathname))
  if (visibles.length === 0) return null

  return visibles.map((evento) => {
    const Capa = evento.Component
    return evento.lazyBoundary ? (
      <Suspense key={evento.id} fallback={null}>
        <Capa />
      </Suspense>
    ) : (
      <Capa key={evento.id} />
    )
  })
}

export default SeasonalLayer
