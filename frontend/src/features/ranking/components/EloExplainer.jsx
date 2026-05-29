import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Medal,
  Swords,
  TrendingUp,
} from 'lucide-react'

function EloExplainer() {
  const pasos = [
    {
      icon: Swords,
      titulo: 'Cada duelo registra una preferencia',
      texto:
        'La comunidad elige entre dos personajes. Es una señal competitiva agregada, no una verdad absoluta sobre poder o canon.',
    },
    {
      icon: TrendingUp,
      titulo: 'La tabla se mueve con votos reales',
      texto:
        'Los tabs históricos y mensuales salen de actividad pública. El ELO base del catálogo sirve como estimación inicial y contexto.',
    },
    {
      icon: Medal,
      titulo: 'El ranking separa histórico y momento',
      texto:
        'El histórico acumula toda la actividad; el mes enseña qué personajes vienen moviendo el meta ahora.',
    },
  ]

  return (
    <section
      aria-labelledby="elo-explicacion"
      className="as-panel mt-8 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-gold">
            Cómo se mueve la tabla
          </p>
          <h2 id="elo-explicacion" className="mt-1 text-2xl">
            El ranking mezcla actividad comunitaria y contexto competitivo
          </h2>
        </div>
        <Link
          to="/metodologia-elo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface-alt px-3 py-2 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
        >
          Ver metodología
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {pasos.map(({ icon: Icon, titulo, texto }) => (
          <div
            key={titulo}
            className="rounded-2xl border border-border bg-bg/45 p-4"
          >
            <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-gold">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-base">{titulo}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              {texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default EloExplainer
