import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Share2,
  Swords,
  Zap,
} from 'lucide-react'

function VotarQuickModes({ a, b, fixedAnime, fixedPersonaje, hasFixedAnime, hasFixedDuel }) {
  const animeContext = hasFixedAnime ? fixedAnime : a?.anime || b?.anime || ''
  const animeHref = animeContext
    ? `/votar?anime=${encodeURIComponent(animeContext)}`
    : '/animes'
  const compareHref = a?.slug && b?.slug
    ? `/comparar?a=${encodeURIComponent(a.slug)}&b=${encodeURIComponent(b.slug)}`
    : '/comparar'

  return (
    <nav
      aria-label="Modos rápidos de voto"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
    >
      <QuickModeLink
        to="/votar"
        icon={Swords}
        label="Equilibrado"
        detail="Rivales cercanos"
        active={!fixedPersonaje && !hasFixedAnime && !hasFixedDuel}
      />
      <QuickModeLink
        to={animeHref}
        icon={Zap}
        label="Mismo anime"
        detail={animeContext || 'Elige universo'}
        active={hasFixedAnime}
      />
      <QuickModeLink
        to={compareHref}
        icon={Share2}
        label="Comparar"
        detail={a?.nombre && b?.nombre ? `${a.nombre} vs ${b.nombre}` : 'Crea un versus'}
      />
      <QuickModeLink
        to="/misiones"
        icon={ArrowRight}
        label="Misión diaria"
        detail="Completa 10 votos"
      />
    </nav>
  )
}

function QuickModeLink({ to, icon: Icon, label, detail, active = false }) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[58px] min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        active
          ? 'border-gold/55 bg-gold-soft text-gold'
          : 'border-border bg-surface/90 text-fg-muted hover:border-accent/50 hover:text-fg-strong'
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
          active
            ? 'border-gold/45 bg-gold/15'
            : 'border-border bg-bg/50 group-hover:border-accent/35'
        }`}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-black text-fg-strong">
          {label}
        </span>
        <span className="block truncate text-[11px] font-semibold text-fg-muted">
          {detail}
        </span>
      </span>
    </Link>
  )
}

export default VotarQuickModes
