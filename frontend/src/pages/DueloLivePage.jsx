import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Loader2, LogOut, Radio, Share2, ShieldCheck, Swords, Zap } from 'lucide-react'
import { endpoints, ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useStompSubscription } from '../hooks/useStompSubscription'
import { useSeo } from '../hooks/useSeo'
import { shareOrCopy } from '../lib/share'
import { recordDailyShare } from '../lib/dailyProgress'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import Avatar from '../components/Avatar'
import VoteFeedbackBurst from '../components/VoteFeedbackBurst'
import PersonajeImg from '../components/PersonajeImg'
import DuelCeremony from '../features/dueloLive/DuelCeremony'
import WaitingSonar from '../features/dueloLive/WaitingSonar'
import {
  getDueloLivePollDelay,
  isRecoverableDueloLiveState,
  isStaleDueloLiveUpdate,
  shouldPollDueloLiveFallback,
} from '../lib/dueloLiveRecoveryPolicy'

function toMs(value) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function useServerCountdown(serverNow, target) {
  const targetMs = toMs(target)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (targetMs == null) return undefined
    const server = toMs(serverNow)
    const offset = server == null ? 0 : server - Date.now()
    const tick = () => {
      if (document.hidden) return // pausa con la pestaña oculta (valor derivado de Date.now, sin deriva)
      setRemaining(Math.max(0, targetMs - (Date.now() + offset)))
    }
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 200)
    const onVisible = () => {
      if (!document.hidden) tick() // al volver, refresca ya
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [serverNow, targetMs])

  return remaining
}

function useElapsedSeconds(serverNow, startedAt) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = toMs(startedAt)
    if (start == null) return undefined
    const server = toMs(serverNow)
    const offset = server == null ? 0 : server - Date.now()
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() + offset - start) / 1000)))
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [serverNow, startedAt])
  return seconds
}

function formatSeconds(ms) {
  return Math.ceil(ms / 1000)
}

function buildPvpShareText(state, resultado, delta) {
  const marcador = `${state?.miScore ?? 0}-${state?.rivalScore ?? 0}`
  const deltaText = delta == null ? '' : ` (${delta >= 0 ? '+' : ''}${delta} ELO PvP)`
  const rival = state?.rival?.username ? ` contra ${state.rival.username}` : ''
  return `${resultado || 'Duelo'} PvP en AnimeShowdown${rival}: ${marcador}${deltaText}.\n¿Te atreves a superar mi duelo?`
}

/**
 * Comparte el resultado del duelo PvP (Web Share nativo o copia al
 * portapapeles). Reusado por la card de resultado del arena Y por la ceremonia
 * de victoria (loop viral: el share llega en el pico de emoción, al ganar).
 */
async function compartirDuelo(state) {
  if (!state) return
  const delta = state.miEloDelta
  const resultado = delta == null
    ? null
    : delta > 0 ? 'Victoria' : delta < 0 ? 'Derrota' : 'Empate'
  try {
    const result = await shareOrCopy({
      title: 'Mi duelo PvP en AnimeShowdown',
      text: buildPvpShareText(state, resultado, delta),
      url: '/duel-live',
    })
    if (result === 'cancelled') return
    recordDailyShare()
    toast.success(result === 'native' ? 'Resultado compartido' : 'Resultado copiado')
  } catch (error) {
    toast.error('No se pudo compartir el resultado', {
      description: error?.message || 'Copia el marcador manualmente.',
    })
  }
}

function DueloLivePage() {
  useSeo({
    title: 'Duelo PvP en directo · AnimeShowdown',
    description: 'Entra en cola, juega un duelo 1v1 al mejor de 5 rondas y sube tu ELO PvP.',
    image: '/api/og/pvp.png',
    noindex: true,
  })
  const { user } = useAuth()
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [voting, setVoting] = useState(false)
  // Ceremonia 勝/敗: solo cuando PRESENCIAMOS la transición a FINISHED (no
  // al recargar con un duelo ya terminado) y solo con resultado win/lose —
  // el empate (delta 0) conserva la card de siempre. La detección vive en
  // aplicarEstado (contexto de evento: WS/poll/respuestas), no en un effect.
  const [ceremony, setCeremony] = useState(null)
  const prevEstadoRef = useRef(null)
  const lastDueloLivePushAtRef = useRef(0)
  // serverNow (epoch ms) del último estado APLICADO: marca de orden para
  // descartar respuestas fuera de secuencia (una HTTP lenta que llega tras un
  // push WS más nuevo y revertiría el duelo). Ver isStaleDueloLiveUpdate.
  const lastAppliedServerNowRef = useRef(0)
  const { lastMessage, connected } = useStompSubscription('/user/queue/duelo', {
    enabled: Boolean(user),
  })

  const aplicarEstado = useCallback((data) => {
    if (!data) return
    // Guarda de orden: si esta respuesta es más vieja que el último estado ya
    // aplicado, la ignoramos (sin tocar prevEstado ni la ceremonia) para no
    // revertir el duelo. Las vías frescas (push WS, acciones del usuario)
    // siempre traen un serverNow mayor, así que nunca se descartan.
    const incomingServerNow = toMs(data.serverNow)
    if (isStaleDueloLiveUpdate(lastAppliedServerNowRef.current, incomingServerNow)) return
    if (incomingServerNow != null) lastAppliedServerNowRef.current = incomingServerNow
    const prev = prevEstadoRef.current
    prevEstadoRef.current = data.estado
    if (data.estado === 'FINISHED' && prev != null && prev !== 'FINISHED') {
      const delta = data.miEloDelta
      if (delta != null && delta !== 0) {
        setCeremony({
          id: data.id,
          outcome: delta > 0 ? 'win' : 'lose',
          delta,
          ratingBefore: (data?.yo?.eloPvp ?? delta) - delta,
        })
      }
    }
    setState(data)
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    endpoints.dueloLiveActive()
      .then((data) => {
        if (!cancelled && data) aplicarEstado(data)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status !== 204) {
          toast.error('No pudimos recuperar tu duelo PvP', { description: err.message })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, aplicarEstado])

  useEffect(() => {
    if (!lastMessage) return
    lastDueloLivePushAtRef.current = Date.now()
    queueMicrotask(() => aplicarEstado(lastMessage))
    if (lastMessage.event === 'MATCH_FOUND') {
      toast.success('Rival encontrado', { description: 'Duelo listo' })
    }
    if (lastMessage.event === 'MATCH_END' || lastMessage.event === 'OPPONENT_ABANDONED') {
      toast.success('Duelo terminado', { description: lastMessage.message ?? 'Resultado calculado' })
    }
  }, [lastMessage, aplicarEstado])

  const estadoActual = state?.estado
  const dueloId = state?.id

  useEffect(() => {
    if (!user || !isRecoverableDueloLiveState(estadoActual)) return undefined
    let cancelled = false
    let timeoutId
    let failures = 0

    function schedule() {
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, getDueloLivePollDelay(failures))
      }
    }

    function poll() {
      if (!shouldPollDueloLiveFallback({
        user,
        state: { estado: estadoActual },
        connected,
        lastPushAt: lastDueloLivePushAtRef.current,
      })) {
        failures = 0
        schedule()
        return
      }
      const request = dueloId ? endpoints.dueloLiveState(dueloId) : endpoints.dueloLiveActive()
      request
        .then((data) => {
          if (cancelled) return
          failures = 0
          if (data) aplicarEstado(data)
        })
        .catch(() => {
          failures += 1
        })
        .finally(schedule)
    }

    schedule()
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [connected, dueloId, estadoActual, user, aplicarEstado])

  if (!user) return <Navigate to="/login?next=/duel-live" replace />

  const join = async () => {
    setJoining(true)
    try {
      aplicarEstado(await endpoints.dueloLiveJoin())
    } catch (err) {
      toast.error('No pudimos entrar en cola', { description: err.message })
    } finally {
      setJoining(false)
    }
  }

  const vote = async (choice) => {
    if (!state?.id || voting) return
    setVoting(true)
    try {
      aplicarEstado(await endpoints.dueloLiveVote(state.id, choice))
    } catch (err) {
      toast.error('No pudimos registrar el voto', { description: err.message })
    } finally {
      setVoting(false)
    }
  }

  const leave = async () => {
    if (!state?.id) return
    try {
      aplicarEstado(await endpoints.dueloLiveLeave(state.id))
    } catch (err) {
      toast.error('No pudimos salir del duelo', { description: err.message })
    }
  }

  return (
    <VisualPageShell
      visual={{ ...BRAND_VISUALS.torneos, kanji: '決' }}
      className="py-10 sm:py-12"
      contentClassName="mx-auto max-w-6xl"
      lateralKanji={{ left: '対', right: '戦' }}
    >
      <section className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black text-gold">PvP live</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-fg-strong sm:text-5xl">
            Duelo 1v1 en directo
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-muted">
            Mejor de 5 rondas. Acertar significa coincidir con la mayoría histórica de la comunidad.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-fg-muted">
          <Radio className={`h-4 w-4 ${connected ? 'text-success' : 'text-gold'}`} />
          {connected ? 'Conectado en directo' : 'Reconectando directo'}
        </div>
      </section>

      {loading ? (
        <EmptyArena icon={Loader2} title="Buscando sesión activa" spin />
      ) : !state || state.estado === 'ABANDONED' || state.estado === 'FINISHED' ? (
        <StartArena state={state} joining={joining} onJoin={join} />
      ) : state.estado === 'WAITING' ? (
        <WaitingArena state={state} user={user} onLeave={leave} />
      ) : (
        <BattleArena state={state} voting={voting} onVote={vote} onLeave={leave} />
      )}

      {ceremony && (
        <DuelCeremony
          key={ceremony.id}
          outcome={ceremony.outcome}
          delta={ceremony.delta}
          ratingBefore={ceremony.ratingBefore}
          onShare={() => compartirDuelo(state)}
          onDone={() => setCeremony(null)}
        />
      )}
    </VisualPageShell>
  )
}

function StartArena({ state, joining, onJoin }) {
  const delta = state?.miEloDelta
  const resultado = delta == null
    ? null
    : delta > 0
      ? 'Victoria'
      : delta < 0
        ? 'Derrota'
        : 'Empate'
  const compartirResultado = () => compartirDuelo(state)
  return (
    <div className="as-panel overflow-hidden rounded-2xl border border-border bg-surface/80 p-6 shadow-xl shadow-black/25">
      {state?.estado === 'FINISHED' || state?.estado === 'ABANDONED' ? (
        <div className="relative mb-6 overflow-hidden rounded-xl border border-gold/30 bg-gold/10 p-5">
          <VoteFeedbackBurst
            active={delta != null}
            delta={delta}
            value={state?.yo?.eloPvp}
            label="ELO PvP"
          />
          <p className="text-xs font-black text-gold">Resultado final</p>
          {resultado && (
            <p className={`mt-2 text-4xl font-black ${
              resultado === 'Victoria'
                ? 'text-success'
                : resultado === 'Derrota'
                  ? 'text-danger'
                  : 'text-gold'
            }`}>
              {resultado}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <h2 className="text-3xl font-black text-fg-strong">
              {state.miScore} - {state.rivalScore}
            </h2>
            {delta != null && (
              <span className={`text-2xl font-black tabular-nums ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
                {delta >= 0 ? '+' : ''}{delta} ELO PvP
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-fg-muted">
            Tu nuevo ELO PvP aparecerá también en tu perfil.
          </p>
          <button
            type="button"
            onClick={compartirResultado}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gold/30 bg-bg/60 px-4 py-2 text-sm font-black text-gold transition hover:border-gold/60 hover:bg-gold/10"
          >
            <Share2 className="h-4 w-4" />
            Compartir resultado
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onJoin}
        disabled={joining}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-black text-white shadow-lg shadow-primary/25 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
        Entrar en cola PvP
      </button>
    </div>
  )
}

function WaitingArena({ state, user, onLeave }) {
  const seconds = useElapsedSeconds(state.serverNow, state.creadoEn)
  const fallbackRaw = Number(state.fallbackAfterSeconds ?? 10)
  const fallbackAfter = Number.isFinite(fallbackRaw) ? Math.max(3, fallbackRaw) : 10
  const quickStartIn = Math.max(0, fallbackAfter - seconds)
  const fallbackProgress = Math.min(100, (seconds / fallbackAfter) * 100)
  return (
    <div className="as-panel rounded-2xl border border-border bg-surface/80 p-8 text-center shadow-xl shadow-black/25">
      {/* sonar de combate en lugar del spinner: anillos + taiko a ~52 bpm */}
      <WaitingSonar user={user} />
      <h2 className="mt-2 text-3xl font-black text-fg-strong">Buscando rival</h2>
      <p className="mt-2 text-sm text-fg-muted">
        Eres el #{state.queuePosition || 1} en cola · {seconds}s esperando
      </p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-fg-muted">
        {quickStartIn > 0
          ? `Si no aparece nadie, partida rápida en ${quickStartIn}s.`
          : 'Preparando partida rápida para que puedas jugar ya.'}
      </p>
      <div className="mx-auto mt-5 max-w-md rounded-xl border border-gold/25 bg-bg/45 p-3 text-left">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-black text-gold">
            Partida rápida
          </span>
          <span className="font-mono text-sm font-black tabular-nums text-fg-strong">
            {quickStartIn > 0 ? `${quickStartIn}s` : 'listo'}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={fallbackAfter}
          aria-valuenow={Math.min(seconds, fallbackAfter)}
          aria-label="Cuenta atrás para partida rápida"
          className="h-2 overflow-hidden rounded-full bg-surface-alt"
        >
          {/* scaleX en vez de width: mismo llenado sin re-layout por tick */}
          <div
            className="h-full w-full origin-left rounded-full bg-gradient-to-r from-accent via-gold to-success transition-transform duration-500"
            style={{ transform: `scaleX(${fallbackProgress / 100})` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold text-fg-muted transition hover:border-danger/50 hover:text-danger"
      >
        <LogOut className="h-4 w-4" />
        Salir de cola
      </button>
    </div>
  )
}

function BattleArena({ state, voting, onVote, onLeave }) {
  const startsIn = useServerCountdown(state.serverNow, state.startedEn)
  const remaining = useServerCountdown(state.ronda?.serverNow, state.ronda?.cierraEn)
  const total = Math.max(1, (toMs(state.ronda?.cierraEn) ?? 0) - (toMs(state.ronda?.abreEn) ?? 0))
  const progress = Math.max(0, Math.min(100, (remaining / total) * 100))
  const locked = startsIn > 0 || remaining <= 0 || state.ronda?.miVotoRecibido || voting

  if (startsIn > 0) {
    return (
      <div className="as-panel rounded-2xl border border-border bg-surface/80 p-8 text-center shadow-xl shadow-black/25">
        <VersusHeader state={state} />
        <div className="mt-8 text-7xl font-black tabular-nums text-gold">{formatSeconds(startsIn)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <VersusHeader state={state} />
      <div className="as-panel rounded-2xl border border-border bg-surface/80 p-4 shadow-xl shadow-black/25 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-gold">Ronda {state.ronda?.numero}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {state.ronda?.miVotoRecibido
                ? state.ronda?.rivalVotoRecibido
                  ? 'Ambos votaron. Resolviendo resultado.'
                  : 'Voto registrado. Esperando al rival.'
                : 'Elige el personaje que crees que domina la opinión global.'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums text-fg-strong">{formatSeconds(remaining)}s</div>
            <p className="text-xs text-fg-muted">ventana server-side</p>
          </div>
        </div>
        <progress
          className="mb-6 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-gold"
          max="100"
          value={progress}
          aria-label="Tiempo restante de la ronda"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <CharacterChoice label="A" personaje={state.ronda?.personajeA} disabled={locked} onClick={() => onVote('A')} />
          <CharacterChoice label="B" personaje={state.ronda?.personajeB} disabled={locked} onClick={() => onVote('B')} />
        </div>
        {state.ronda?.eleccionCorrecta && (
          <RoundResult state={state} />
        )}
        <button
          type="button"
          onClick={onLeave}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold text-fg-muted transition hover:border-danger/50 hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
          Abandonar duelo
        </button>
      </div>
    </div>
  )
}

function VersusHeader({ state }) {
  return (
    <div className="as-panel rounded-2xl border border-border bg-bg/60 p-4 shadow-xl shadow-black/20">
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <PlayerBlock player={state.yo} score={state.miScore} align="left" />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-2xl font-black text-gold">
          VS
        </div>
        <PlayerBlock player={state.rival} score={state.rivalScore} align="right" />
      </div>
    </div>
  )
}

function PlayerBlock({ player, score, align }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'md:flex-row-reverse md:text-right' : ''}`}>
      <Avatar user={player} size={64} />
      <div className="min-w-0">
        <p className="truncate text-lg font-black text-fg-strong">{player?.username}</p>
        <p className="text-xs font-bold text-fg-muted">
          {`${player?.eloPvp ?? 1000} ELO PvP`}
        </p>
      </div>
      <div className="ml-auto rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-3xl font-black tabular-nums text-gold md:ml-0">
        {score}
      </div>
    </div>
  )
}

function CharacterChoice({ label, personaje, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group overflow-hidden rounded-2xl border border-border bg-bg/70 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
    >
      <div className="relative aspect-[16/10] bg-surface">
        {personaje?.imagenUrl ? (
          <PersonajeImg
            slug={personaje.slug}
            src={personaje.imagenUrl}
            alt={personaje.nombre}
            colorDominante={personaje.imagenColorDominante}
            loading="eager"
            fetchPriority={label === 'A' ? 'high' : 'auto'}
            sizes="(min-width: 1024px) 420px, 90vw"
            fit="contain"
            position="center"
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" lang="ja" className="flex h-full items-center justify-center text-5xl font-black text-fg-muted">影</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-bg/80 px-3 py-1 text-sm font-black text-gold backdrop-blur">
          {label}
        </span>
      </div>
      <div className="p-4">
        <h3 className="text-2xl font-black text-fg-strong">{personaje?.nombre}</h3>
        <p className="mt-1 text-sm font-bold text-fg-muted">{personaje?.anime}</p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-white">
          <Zap className="h-4 w-4" />
          Votar {label}
        </span>
      </div>
    </button>
  )
}

function RoundResult({ state }) {
  const ok = state.ronda?.yoAcerte
  return (
    <div className={`mt-5 rounded-xl border p-4 ${ok ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10'}`}>
      <div className="flex items-center gap-2 text-sm font-black">
        {ok ? <ShieldCheck className="h-4 w-4 text-success" /> : <Activity className="h-4 w-4 text-danger" />}
        <span className={ok ? 'text-success' : 'text-danger'}>
          {ok ? 'Acertaste la comunidad' : 'La comunidad eligió otra cosa'}
        </span>
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        Opción correcta: {state.ronda.eleccionCorrecta}
      </p>
    </div>
  )
}

function EmptyArena({ icon: Icon, title, spin = false }) {
  return (
    <div className="as-panel rounded-2xl border border-border bg-surface/80 p-8 text-center">
      <Icon className={`mx-auto h-10 w-10 text-gold ${spin ? 'animate-spin' : ''}`} />
      <p className="mt-4 text-lg font-black text-fg-strong">{title}</p>
    </div>
  )
}

export default DueloLivePage
