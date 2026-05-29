import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio, Timer, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { useStompSubscription } from '../hooks/useStompSubscription'
import { imagenPersonaje } from '../lib/personajes-core'
import PersonajeCutImg from './PersonajeCutImg'

function LiveMatchSpectator({ torneo }) {
  const currentMatch = torneo?.currentMatch
  const announcedRef = useRef(false)
  const destination =
    torneo?.estado === 'IN_PROGRESS' && torneo?.slug
      ? `/topic/tournament/${torneo.slug}`
      : null
  const { lastMessage } = useStompSubscription(destination)
  const remainingMs = useServerCountdown(torneo?.liveServerNow, torneo?.liveEndsAt)
  const liveMatch = useMemo(() => {
    if (!currentMatch) return null
    if (!lastMessage || Number(lastMessage.enfrentamientoId) !== Number(currentMatch.id)) {
      return currentMatch
    }
    return {
      ...currentMatch,
      personaje1Votos: Number(lastMessage.personaje1Votos ?? currentMatch.personaje1Votos ?? 0),
      personaje2Votos: Number(lastMessage.personaje2Votos ?? currentMatch.personaje2Votos ?? 0),
      totalVotos: Number(lastMessage.totalVotos ?? currentMatch.totalVotos ?? 0),
    }
  }, [currentMatch, lastMessage])

  useEffect(() => {
    announcedRef.current = false
  }, [currentMatch?.id])

  const leader = useMemo(() => getLeader(liveMatch), [liveMatch])

  useEffect(() => {
    if (!liveMatch || remainingMs !== 0 || announcedRef.current) return
    announcedRef.current = true
    toast.info('Cuenta atrás completada', {
      description: leader
        ? `${leader.nombre} lidera el duelo. Actualiza el bracket para confirmar el cierre.`
        : 'El duelo necesita más votos para romper el empate.',
    })
  }, [leader, liveMatch, remainingMs])

  if (!liveMatch?.personaje1 || !liveMatch?.personaje2) return null

  const p1Votes = Number(liveMatch.personaje1Votos ?? 0)
  const p2Votes = Number(liveMatch.personaje2Votos ?? 0)
  const total = Math.max(0, Number(liveMatch.totalVotos ?? p1Votes + p2Votes))
  const p1Pct = total > 0 ? Math.round((p1Votes / total) * 100) : 50
  const p2Pct = total > 0 ? Math.round((p2Votes / total) * 100) : 50

  return (
    <section
      className="mb-10 overflow-hidden rounded-2xl border border-success/25 bg-surface/95 shadow-lift [--aura-color:rgb(16_185_129_/_0.12)]"
      aria-label="Modo espectador del torneo en directo"
    >
      <div className="flex flex-col gap-4 border-b border-border bg-bg/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
            <Radio className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success">
              Spectator live
            </p>
            <h2 className="text-lg font-extrabold text-fg-strong">
              Ronda {liveMatch.ronda ?? torneo?.rondaActual ?? '?'} en directo
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CountdownPill remainingMs={remainingMs} endsAt={torneo?.liveEndsAt} />
          <a
            href="#duelos-abiertos"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-bold text-bg transition-colors hover:bg-accent-strong"
          >
            Vota aquí
          </a>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:p-5">
        <FighterPanel
          personaje={liveMatch.personaje1}
          votes={p1Votes}
          percent={p1Pct}
          leading={leader?.id === liveMatch.personaje1.id}
        />
        <div className="flex items-center justify-center">
          <span className="rounded-full border border-border bg-bg px-4 py-2 font-mono text-sm font-black text-gold">
            VS
          </span>
        </div>
        <FighterPanel
          personaje={liveMatch.personaje2}
          votes={p2Votes}
          percent={p2Pct}
          leading={leader?.id === liveMatch.personaje2.id}
          alignRight
        />
      </div>

      <div className="grid grid-cols-2 border-t border-border text-[12px] text-fg-muted">
        <ProgressSide percent={p1Pct} votes={p1Votes} side="left" />
        <ProgressSide percent={p2Pct} votes={p2Votes} side="right" />
      </div>
    </section>
  )
}

function FighterPanel({ personaje, votes, percent, leading, alignRight = false }) {
  return (
    <Link
      to={`/personajes/${personaje.slug}`}
      className={`flex min-w-0 items-center gap-4 rounded-xl border border-border bg-bg/70 p-4 transition-colors hover:border-accent/50 ${
        alignRight ? 'sm:flex-row-reverse sm:text-right' : ''
      }`}
    >
      <PersonajeCutImg
        slug={personaje.slug}
        fallback={personaje.imagenUrl || imagenPersonaje(personaje.slug)}
        alt={personaje.nombre}
        loading="lazy"
        className="h-24 w-20 shrink-0 rounded-xl border border-accent/15"
        imgClassName="p-1"
      />
      <div className="min-w-0 flex-1">
        <div className={`mb-1 flex items-center gap-2 ${alignRight ? 'sm:justify-end' : ''}`}>
          {leading && <Trophy className="h-4 w-4 text-gold" aria-label="Liderando" />}
          <p className="line-clamp-1 text-base font-extrabold text-fg-strong">
            {personaje.nombre}
          </p>
        </div>
        <p className="line-clamp-1 text-[12px] text-fg-muted">{personaje.anime}</p>
        <p className="mt-3 font-mono text-sm font-black tabular-nums text-fg-strong">
          {votes} votos · {percent}%
        </p>
      </div>
    </Link>
  )
}

function ProgressSide({ percent, votes, side }) {
  return (
    <div className={`relative overflow-hidden px-4 py-3 ${side === 'right' ? 'text-right' : ''}`}>
      <div
        className={`absolute inset-y-0 ${side === 'right' ? 'right-0' : 'left-0'} bg-accent/15 transition-all duration-300`}
        style={{ width: `${Math.max(6, Math.min(100, percent))}%` }}
      />
      <span className="relative font-mono font-bold tabular-nums">
        {votes} {votes === 1 ? 'voto' : 'votos'}
      </span>
    </div>
  )
}

function CountdownPill({ remainingMs, endsAt }) {
  const hasCountdown = endsAt && Number.isFinite(remainingMs)
  const label = hasCountdown ? formatRemaining(remainingMs) : 'En directo'

  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 font-mono text-sm font-black tabular-nums text-fg-strong">
      <Timer className="h-4 w-4 text-success" />
      {label}
    </span>
  )
}

function useServerCountdown(serverNowIso, endsAtIso) {
  const [remainingMs, setRemainingMs] = useState(Number.NaN)

  useEffect(() => {
    if (!serverNowIso || !endsAtIso) {
      return undefined
    }

    const serverNow = new Date(serverNowIso).getTime()
    const endsAt = new Date(endsAtIso).getTime()
    const clientStart = Date.now()

    const tick = () => {
      const elapsedClient = Date.now() - clientStart
      setRemainingMs(Math.max(0, endsAt - serverNow - elapsedClient))
    }
    const timeout = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(id)
    }
  }, [serverNowIso, endsAtIso])

  return remainingMs
}

function getLeader(match) {
  if (!match?.personaje1 || !match?.personaje2) return null
  const p1 = Number(match.personaje1Votos ?? 0)
  const p2 = Number(match.personaje2Votos ?? 0)
  if (p1 === p2) return null
  return p1 > p2 ? match.personaje1 : match.personaje2
}

function formatRemaining(ms) {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default LiveMatchSpectator
