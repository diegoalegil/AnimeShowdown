import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Swords, Trophy } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'
import { useVotarEnfrentamiento } from '../lib/torneosQueries'
import { imagenPersonaje } from '../lib/personajes-core'
import PersonajeCutImg from './PersonajeCutImg'

/**
 * Strip "Duelos abiertos" arriba del bracket en /torneos/:slug.
 *
 * <p>Audit producto (2026-05-18): el bracket es un mapa global del torneo
 * — útil para entender la estructura pero pésimo como CTA. Un usuario
 * que aterriza en un torneo IN_PROGRESS quiere saber YA dónde puede
 * votar. Este strip muestra hasta 6 duelos abiertos (ambos personajes
 * presentes, sin ganador) con cards 1v1 grandes y dos botones de voto.
 * Si no hay duelos abiertos, la sección no se renderiza (el bracket
 * de abajo es contexto suficiente).
 *
 * <p>Reutiliza la mutation {@link useVotarEnfrentamiento} del flujo del
 * bracket — mismo cache, mismo invalidate, misma UX de error.
 */
function DuelosAbiertosStrip({ enfrentamientos, torneoId, torneoSlug }) {
  const abiertos = (enfrentamientos || [])
    .filter((e) => e.personaje1 && e.personaje2 && !e.ganador)
    // Ordenamos por ronda asc → primero los duelos de la ronda más temprana,
    // que son los que tienen sentido votar ahora.
    .sort((a, b) => (a.ronda ?? 0) - (b.ronda ?? 0) || (a.id ?? 0) - (b.id ?? 0))
    .slice(0, 6)

  if (abiertos.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Swords className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-strong">
            Duelos abiertos
          </h2>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-bold text-accent">
            {abiertos.length}
          </span>
        </div>
        <p className="hidden text-[12px] text-fg-muted sm:block">
          Vota uno y la siguiente ronda se desbloquea en cuanto el resto cierre.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {abiertos.map((e) => (
          <DueloAbiertoCard key={e.id} match={e} torneoSlug={torneoSlug} />
        ))}
      </div>
      {torneoId == null && (
        <p className="mt-3 text-[11px] text-fg-muted">
          Resultados en vivo — recarga si llevas un rato sin moverte.
        </p>
      )}
    </section>
  )
}

function DueloAbiertoCard({ match, torneoSlug }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mutation = useVotarEnfrentamiento(torneoSlug)
  const [votado, setVotado] = useState(null)

  const totalVotos = match.totalVotos ?? 0
  const disabled = mutation.isPending || Boolean(votado)

  const onVote = (personaje) => {
    if (!user) {
      toast.error('Entra para votar este duelo', {
        description: 'Te devolvemos al torneo después.',
      })
      const next = `${location.pathname}${location.search}${location.hash}`
      navigate(`/login?next=${encodeURIComponent(next)}`)
      return
    }
    mutation.mutate(
      { enfrentamientoId: match.id, personajeGanadorId: personaje.id },
      {
        onSuccess: (data) => {
          setVotado(personaje.id)
          toast.success(`Voto para ${personaje.nombre}`, {
            description: data?.votosGanador != null
              ? `${data.votosGanador} votos en este match`
              : 'Bracket actualizado',
          })
        },
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : 0
          if (status === 409) {
            setVotado('ya')
            toast.error('Ya votaste este enfrentamiento')
          } else if (status === 401 || status === 403) {
            const next = `${location.pathname}${location.search}${location.hash}`
            navigate(`/login?next=${encodeURIComponent(next)}`)
          } else {
            toast.error('No se pudo registrar el voto', {
              description: err?.message || 'Inténtalo de nuevo.',
            })
          }
        },
      },
    )
  }

  const rondaLabel = match.ronda ? `Ronda ${match.ronda}` : 'Bracket'

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        <span>{rondaLabel}</span>
        <span className="font-mono tabular-nums">
          {totalVotos} {totalVotos === 1 ? 'voto' : 'votos'}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <FighterTile personaje={match.personaje1} />
        <span className="font-mono text-base font-extrabold text-accent">VS</span>
        <FighterTile personaje={match.personaje2} alignRight />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <VoteBtn
          personaje={match.personaje1}
          active={votado === match.personaje1.id}
          disabled={disabled}
          onClick={() => onVote(match.personaje1)}
        />
        <VoteBtn
          personaje={match.personaje2}
          active={votado === match.personaje2.id}
          disabled={disabled}
          onClick={() => onVote(match.personaje2)}
        />
      </div>
      {votado === 'ya' && (
        <p className="text-center text-[11px] font-medium text-fg-muted">
          Ya habías votado este duelo.
        </p>
      )}
      {votado && votado !== 'ya' && (
        <p className="inline-flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-accent">
          <Trophy className="h-3 w-3" /> Voto registrado
        </p>
      )}
    </motion.article>
  )
}

function FighterTile({ personaje, alignRight = false }) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 ${alignRight ? 'text-right' : ''}`}
    >
      <PersonajeCutImg
        slug={personaje.slug}
        fallback={personaje.imagenUrl || imagenPersonaje(personaje.slug)}
        alt=""
        loading="lazy"
        className="h-24 w-20 shrink-0 rounded-xl border border-accent/15"
        imgClassName="p-1"
      />
      <div className="min-w-0">
        <p className="line-clamp-1 text-center text-[13px] font-semibold text-fg-strong">
          {personaje.nombre}
        </p>
        <p className="line-clamp-1 text-center text-[11px] text-fg-muted">{personaje.anime}</p>
      </div>
    </div>
  )
}

function VoteBtn({ personaje, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Votar a ${personaje.nombre}`}
      className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
        active
          ? 'border-accent bg-accent text-bg'
          : 'border-border bg-bg text-fg-strong hover:border-accent hover:bg-accent-soft hover:text-accent'
      }`}
    >
      <span className="line-clamp-1">{personaje.nombre}</span>
    </button>
  )
}

export default DuelosAbiertosStrip
