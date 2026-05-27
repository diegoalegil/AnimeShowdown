import { ArrowRight, CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EditorialCover from '../../../../components/EditorialCover'
import {
  ESTADO_EVENTO,
  formatRestante,
  getEstadoEvento,
  getEventoHeadline,
  getMsRestantes,
  getPersonajesEvento,
} from '../../../../data/eventos'
import { getEventVisual } from '../../../../data/visual-assets'

/**
 * Banner del evento "headline". Muestra el
 * primer evento activo, o el próximo más cercano si no hay activos.
 * Auto-refresh del contador cada 60s para que "termina en 3h" baje a
 * "termina en 2h" sin recargar la página.
 */
function EventoHeadlineBanner() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const evento = getEventoHeadline(now)
  if (!evento) return null

  const estado = getEstadoEvento(evento, now)
  const ms = getMsRestantes(evento, now)
  const restante = formatRestante(ms)
  const participantes = getPersonajesEvento(evento).length
  const visual = getEventVisual(evento.slug, evento.titulo)

  const tonosBg = {
    rose: 'border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent',
    violet: 'border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    pink: 'border-pink-500/30 bg-gradient-to-br from-pink-500/15 via-pink-500/5 to-transparent',
    cyan: 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-transparent',
  }
  const tonosTexto = {
    rose: 'text-rose-200',
    violet: 'text-violet-200',
    amber: 'text-amber-200',
    pink: 'text-pink-200',
    cyan: 'text-cyan-200',
  }
  const tonoBg = tonosBg[evento.color] ?? tonosBg.amber
  const tonoTexto = tonosTexto[evento.color] ?? tonosTexto.amber

  const ctaLabel = estado === ESTADO_EVENTO.ACTIVO ? 'Entrar al evento' : 'Ver detalles'
  const tiempoLabel = estado === ESTADO_EVENTO.ACTIVO
    ? `Termina en ${restante}`
    : `Empieza en ${restante}`
  const eyebrowLabel = estado === ESTADO_EVENTO.ACTIVO ? 'Evento en curso' : 'Próximo evento'

  return (
    <div className={`relative mb-3 overflow-hidden rounded-xl border p-4 sm:mb-4 sm:p-5 ${tonoBg}`}>
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-105 contrast-100"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <span className={`inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${tonoTexto}`}>
            <CalendarClock className="h-3 w-3" />
            {eyebrowLabel} · {tiempoLabel}
          </span>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl sm:text-2xl">
              {evento.emoji}
            </span>
            <h3 className="text-lg font-extrabold text-fg-strong drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] sm:text-xl">
              {evento.titulo}
            </h3>
          </div>
          <p className="line-clamp-2 text-[13px] text-fg-muted drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {evento.descripcionCorta} · {participantes} personajes
          </p>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <span className="rounded-full border border-white/10 bg-bg/55 px-3 py-1 font-mono text-[11px] font-bold text-fg-muted backdrop-blur">
            {participantes} participantes
          </span>
          <Link
            to={`/eventos/${evento.slug}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-bg/40 px-4 py-2 text-[13px] font-semibold ${tonoTexto} hover:bg-bg/60`}
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default EventoHeadlineBanner
