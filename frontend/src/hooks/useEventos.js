import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api'
import { EVENTOS } from '../data/eventos'

/**
 * Fuente de eventos en runtime.
 *
 * <p>Prefiere la API pública (`GET /api/eventos`) y cae al hardcode de
 * `data/eventos.js` si la lista viene vacía o la llamada falla. Así el front
 * nunca se queda sin eventos aunque la tabla `eventos_tematicos` esté sin
 * sembrar o el backend no responda — la migración a runtime es aditiva, sin
 * pérdida de contenido.
 *
 * <p>El DTO del backend comparte el shape del hardcode (slug, titulo,
 * descripcionCorta, tipo{kind,valor}, inicioISO, finISO, color, emoji), por lo
 * que los helpers de `data/eventos.js` (estado, countdown, filtro de
 * personajes) sirven a ambos orígenes sin mapeo.
 */
export function useEventos() {
  const { data } = useQuery({
    queryKey: ['eventos'],
    queryFn: endpoints.eventos,
    staleTime: 5 * 60 * 1000,
  })
  return Array.isArray(data) && data.length > 0 ? data : EVENTOS
}
