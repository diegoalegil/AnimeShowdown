import LostPath from './LostPath'
import { useSeo } from '../hooks/useSeo'

/**
 * 404 del sistema. La parte visual vive en LostPath (pieza 100): el recinto en
 * niebla, peso pluma y sin imágenes.
 *
 * <p>Status "404 real": la SPA se sirve desde un único index.html (el CDN
 * responde 200 para cualquier ruta), así que no hay un HTTP 404 de verdad —
 * el 404 se marca para crawlers con {@code noindex} + título "404" vía
 * useSeo. Las rutas conocidas tienen prerender SEO; las desconocidas caen
 * aquí (soft-404 con noindex).
 *
 * <p>También lo reutilizan DueloVersusPage y EventoDetailPage para un slug
 * inválido (ahí el heurístico de sugerencia de personaje no aplica y se ve el
 * 404 genérico, que es lo correcto).
 */
function NotFoundPage() {
  useSeo({ title: '404 — Página no encontrada', noindex: true })
  return <LostPath />
}

export default NotFoundPage
