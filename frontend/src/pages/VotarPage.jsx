import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, LogIn, SkipForward, Swords, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { personajes, imagenPersonaje, getPopularidad } from '../lib/personajes-core'
import { endpoints, ApiError, api } from '../lib/api'
import {
  getAnonymousVoteHeaders,
  getAnonymousVotesCount,
  incrementAnonymousVotesCount,
} from '../lib/anonymousVoting'
import { useSeo } from '../hooks/useSeo'
import { useSound } from '../contexts/SoundContext'
import { useAuth } from '../contexts/AuthContext'
import { VisualPageShell } from '../components/VisualSystem'
import KanjiSpinner from '../components/KanjiSpinner'
import { BRAND_VISUALS } from '../data/visual-assets'
import VoteFeedbackBurst from '../components/VoteFeedbackBurst'
import AccessibleDialog from '../components/AccessibleDialog'

/**
 * VotarPage — arena de duelo rápido (rebrand Plan v2 §14).
 *
 * Pantalla diseñada para que todo el duelo quepa sin scroll:
 *   - Cards con max-h 55vh + object-contain (no recorta) + letterbox
 *     blur de la propia imagen como fondo (rellena las barras sin
 *     mostrar negro puro). Versión robusta tras intento fallido con
 *     object-cover que recortaba info importante de cartas SSR.
 *   - VS central grande con glow magenta.
 *   - "Saltar" arriba a la derecha, siempre visible.
 *   - Nombre + anime debajo de cada card (no overlay) → comparación rápida.
 *   - Atajos de teclado: ← vota izquierda, → derecha, S saltar, Espacio
 *     siguiente cuando ya hay voto.
 *   - Modo rápido (toggle): tras votar carga el siguiente duelo en 1.2s.
 *
 * Mantiene el modo híbrido del backend (match real si hay torneo, casual
 * con pares random local si no).
 */

const STORAGE_FAST = 'animeshowdown.votar.fast'
const STORAGE_VOTES_COUNT = 'animeshowdown.votos_count'
const VOTES_COUNT_EVENT = 'animeshowdown:votes-count'
const ANON_VOTE_LIMIT = 5
// Pausa entre voto y siguiente duelo. 1.8s da tiempo a ver el "+1 ELO"
// animado y a confirmar visualmente quién ganó sin que el usuario tenga
// que pulsar nada. Si se acorta a <1s no da pause para el overlay; si
// se alarga >2s el flow se siente lento.
const NEXT_DELAY_MS = 1800

/**
 * Emparejamientos balanceados + anti-repetición (Plan v2 §4.x).
 *
 * Antes era 100% random sobre los 730 personajes — salían combinaciones
 * sin sentido (un nicho contra Luffy). Ahora:
 *   1. A es completamente aleatorio (penalizando personajes vistos
 *      recientemente para que no repita el mismo en 3 enfrentamientos
 *      seguidos).
 *   2. B se busca con popularidad cercana a A (delta ≤ 12 puntos).
 *   3. Si tras 25 intentos no encuentra match cercano (zona muy peculiar),
 *      ampliamos a delta 25 con un intento más. Si tampoco, fallback a
 *      random clásico (garantizamos siempre devolver un par).
 *
 * El delta 12 sobre popularidad [0,100] se traduce a ELO ~±84 (popularidad·7),
 * range razonable para que el duelo se sienta competido sin clonar pares.
 *
 * Audit feedback (2026-05-22): los duelos "parecen repetirse demasiado".
 * Añadimos buffer de últimos pares en sessionStorage para evitar el
 * mismo enfrentamiento (A vs B y B vs A son equivalentes) y penalizar
 * a personajes vistos en los últimos 6 duelos. sessionStorage (no
 * localStorage) porque queremos que la memoria se limpie al cerrar la
 * pestaña — sesión a sesión empezamos en blanco.
 */
const RECENT_PAIRS_KEY = 'animeshowdown.votar.recent-pairs'
const RECENT_CHARS_KEY = 'animeshowdown.votar.recent-chars'
const RECENT_PAIRS_MAX = 20
const RECENT_CHARS_MAX = 6

function pairKey(slugA, slugB) {
  // A↔B equivalentes: ordenamos alfabéticamente el slug menor primero.
  return slugA < slugB ? `${slugA}|${slugB}` : `${slugB}|${slugA}`
}

function readSessionList(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSessionList(key, list, max) {
  try {
    const trimmed = list.slice(-max)
    sessionStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // sessionStorage puede fallar en private mode; sin él, la anti-
    // repetición simplemente no funciona en esa sesión (acceptable).
  }
}

function recordRecentPair(slugA, slugB) {
  const pairs = readSessionList(RECENT_PAIRS_KEY)
  pairs.push(pairKey(slugA, slugB))
  writeSessionList(RECENT_PAIRS_KEY, pairs, RECENT_PAIRS_MAX)
  const chars = readSessionList(RECENT_CHARS_KEY)
  chars.push(slugA, slugB)
  writeSessionList(RECENT_CHARS_KEY, chars, RECENT_CHARS_MAX * 2)
}

function getRandomPair() {
  if (personajes.length < 2) return [personajes[0], personajes[0]]
  const recentPairs = new Set(readSessionList(RECENT_PAIRS_KEY))
  const recentChars = new Set(readSessionList(RECENT_CHARS_KEY))

  // Helper: índice random preferentemente fuera de recentChars. Si tras N
  // intentos no encuentra uno fresco, devuelve cualquiera (no bloqueamos).
  const pickIdxA = () => {
    for (let i = 0; i < 30; i++) {
      const idx = Math.floor(Math.random() * personajes.length)
      if (!recentChars.has(personajes[idx].slug)) return idx
    }
    return Math.floor(Math.random() * personajes.length)
  }

  const tryPair = (deltaMax, intentos, blockRecent) => {
    const idxA = pickIdxA()
    const a = personajes[idxA]
    const popA = getPopularidad(a.slug)
    for (let i = 0; i < intentos; i++) {
      const idxB = Math.floor(Math.random() * personajes.length)
      if (idxB === idxA) continue
      const b = personajes[idxB]
      if (Math.abs(getPopularidad(b.slug) - popA) > deltaMax) continue
      if (blockRecent && recentPairs.has(pairKey(a.slug, b.slug))) continue
      if (blockRecent && recentChars.has(b.slug)) continue
      return [a, b]
    }
    return null
  }

  // Paso 1: ELO cercano + sin repeticiones recientes (delta 12, 25 tries).
  // Paso 2: relajamos el anti-repetición pero mantenemos ELO cercano.
  // Paso 3: relajamos ELO pero no recientes.
  // Paso 4: random clásico (último recurso).
  const pair =
    tryPair(12, 25, true) ?? tryPair(12, 12, false) ?? tryPair(25, 10, true)
  if (pair) {
    recordRecentPair(pair[0].slug, pair[1].slug)
    return pair
  }

  // Fallback final: random sin restricciones (catálogo demasiado pequeño
  // o restricciones imposibles de satisfacer).
  const idxA = Math.floor(Math.random() * personajes.length)
  let idxB = Math.floor(Math.random() * personajes.length)
  while (idxB === idxA) idxB = Math.floor(Math.random() * personajes.length)
  const fallback = [personajes[idxA], personajes[idxB]]
  recordRecentPair(fallback[0].slug, fallback[1].slug)
  return fallback
}

function incrementarContadorLocalVotos() {
  try {
    const current = Number(localStorage.getItem(STORAGE_VOTES_COUNT) || '0')
    const next = Number.isFinite(current) ? current + 1 : 1
    localStorage.setItem(STORAGE_VOTES_COUNT, String(next))
    window.dispatchEvent(new CustomEvent(VOTES_COUNT_EVENT, { detail: next }))
  } catch {
    // localStorage puede fallar en privacy mode; votar no debe depender de esto.
  }
}

function VotarPage() {
  useSeo({
    title: 'Votar',
    description:
      'Arena de duelos: elige al ganador de cada enfrentamiento entre personajes anime y mueve el ranking ELO de AnimeShowdown.',
  })
  const { play } = useSound()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: enfrentamiento,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['enfrentamientos', 'aleatorio'],
    queryFn: endpoints.enfrentamientoAleatorio,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const [casualPair, setCasualPair] = useState(getRandomPair)
  const [votedFor, setVotedFor] = useState(null)
  // Auto-next por default (opt-out vía toggle). Antes era opt-in y la
  // gente tenía que pulsar "Siguiente duelo" tras cada voto — un click
  // extra por enfrentamiento que rompía el ritmo. Solo se respeta el
  // valor de localStorage si fue setado explícitamente a "false";
  // cualquier otro estado (incluido no haber preferencia) = true.
  const [fastMode, setFastMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_FAST) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAST, String(fastMode))
    } catch {
      // ignore
    }
  }, [fastMode])

  // Resultado del último voto registrado: el backend devuelve delta + votos
  // post-voto. Sirve para pintar el overlay "+1 ELO" sobre la card ganadora.
  // Se resetea cuando llega un nuevo enfrentamiento o tras saltar.
  const [voteResult, setVoteResult] = useState(null)
  const [showAnonLimitModal, setShowAnonLimitModal] = useState(false)

  // Audit P3 (2026-05-17): ref para cancelar el timeout de auto-next si
  // el usuario pulsa "Siguiente duelo" antes de que dispare (o si el
  // componente se desmonta). Antes el timeout quedaba huérfano y podía
  // disparar handleNext dos veces (manual + auto) saltando dos matches.
  const autoNextTimeoutRef = useRef(null)

  const votarMutation = useMutation({
    mutationFn: ({ enfrentamientoId, personajeGanadorId, anonymous }) =>
      endpoints.votar(enfrentamientoId, personajeGanadorId, {
        anonymous,
        headers: anonymous ? getAnonymousVoteHeaders() : {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torneos'] })
    },
  })

  const modoBackend = Boolean(enfrentamiento && !isError)
  const sinMatchesAbiertos =
    isError && error instanceof ApiError && error.status === 404
  const {
    data: dueloSugerido,
    refetch: refetchDueloSugerido,
    isFetching: isFetchingDueloSugerido,
  } = useQuery({
    queryKey: ['votar', 'duelo-sugerido'],
    queryFn: endpoints.dueloSugerido,
    enabled: !isLoading && !modoBackend,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const modoSugerido = Boolean(
    !modoBackend && dueloSugerido?.personaje1 && dueloSugerido?.personaje2,
  )
  const votoInvitadoActivo = modoBackend && !user

  // Datos a renderizar uniformes para ambos modos. Calculados antes del
  // early-return de loading para que los handlers (useCallback) puedan
  // capturarlos en su closure sin warning de eslint.
  let a, b, matchId
  if (modoBackend) {
    a = enfrentamiento.personaje1
    b = enfrentamiento.personaje2
    matchId = enfrentamiento.id
  } else if (modoSugerido) {
    a = dueloSugerido.personaje1
    b = dueloSugerido.personaje2
    matchId = null
  } else {
    ;[a, b] = casualPair
    matchId = null
  }

  const handleNext = useCallback(() => {
    // Cancela cualquier auto-next pendiente — el user pulsó manual
    // antes del timeout, no queremos saltar dos matches.
    if (autoNextTimeoutRef.current != null) {
      clearTimeout(autoNextTimeoutRef.current)
      autoNextTimeoutRef.current = null
    }
    play('playClick')
    setVotedFor(null)
    setVoteResult(null)
    if (modoBackend) {
      refetch()
    } else if (modoSugerido) {
      refetchDueloSugerido()
    } else {
      setCasualPair(getRandomPair())
    }
  }, [play, modoBackend, modoSugerido, refetch, refetchDueloSugerido])

  const handleVote = useCallback(
    (personaje) => {
      if (votedFor) return
      // Solo playVote: antes había también playImpact (sub-bass thump)
      // pero los dos juntos disparaban 9 nodos Web Audio en el mismo
      // tick del click handler y se percibía un lag perceptible entre
      // el click y el primer sample. playVote ya tiene 4 notas + sparkle,
      // suficiente para feedback contundente.
      play('playVote')

      if (modoBackend) {
        if (!user) {
          if (getAnonymousVotesCount() >= ANON_VOTE_LIMIT) {
            setShowAnonLimitModal(true)
            toast.info('Límite invitado alcanzado', {
              description: 'Crea cuenta gratis para seguir votando y guardar tu racha.',
            })
            return
          }
        }
        setVotedFor(personaje.slug)
        votarMutation.mutate(
          { enfrentamientoId: matchId, personajeGanadorId: personaje.id, anonymous: !user },
          {
            onSuccess: (data) => {
              if (data?.anonimo) {
                incrementAnonymousVotesCount()
              }
              incrementarContadorLocalVotos()
              // Propuesta §4.x: el backend devuelve VotoRegistradoDto con
              // delta + counts post. Lo guardamos para que VoteCard pinte
              // el overlay "+1 ELO". Fallback defensivo si el payload
              // viene incompleto (compat con versiones anteriores).
              setVoteResult({
                ganadorSlug: personaje.slug,
                delta: data?.delta ?? 1,
                votosGanador: data?.votosGanador ?? null,
              })
              const delta = data?.delta ?? 1
              toast.success(`+${delta} ELO · ${personaje.nombre}`, {
                description: data?.votosGanador != null
                  ? data?.anonimo
                    ? `Voto invitado guardado · te quedan ${data.votosAnonimosRestantes ?? 0}`
                    : `Ahora suma ${data.votosGanador} votos en este match`
                  : 'Voto registrado · ranking actualizado',
              })
              if (fastMode) {
                autoNextTimeoutRef.current = setTimeout(() => {
                  autoNextTimeoutRef.current = null
                  handleNext()
                }, NEXT_DELAY_MS)
              }
            },
            onError: (err) => {
              setVotedFor(null)
              const status = err instanceof ApiError ? err.status : 0
              if (status === 409) {
                toast.error('Ya votaste este enfrentamiento')
              } else if (status === 429) {
                // 429 puede venir por dos razones:
                //  - usuario anónimo agotó sus 5 votos invitados → modal CTA
                //  - usuario autenticado cayó en el rate limit del backend
                //    (votos demasiado rápidos) → toast neutral, NUNCA el
                //    modal de "crea cuenta" porque ya la tiene.
                // Antes mostraba el modal sin distinguir, lo que confundía
                // a usuarios logueados con un CTA que no aplicaba.
                if (!user) {
                  setShowAnonLimitModal(true)
                } else {
                  toast.error('Votas demasiado rápido', {
                    description: 'Espera unos segundos antes de votar de nuevo.',
                  })
                }
              } else if (status === 401) {
                navigate({
                  pathname: '/login',
                  search: `?next=${encodeURIComponent('/votar')}`,
                })
              } else if (status >= 500) {
                if (import.meta.env.DEV) {
                  console.error('[votar] error 5xx al registrar voto', err)
                }
                toast.error('El servidor no pudo registrar el voto', {
                  description: 'No se guardó tu elección. Inténtalo de nuevo en unos segundos.',
                })
              } else {
                toast.error('No se pudo registrar el voto', {
                  description: err?.message || 'Inténtalo de nuevo.',
                })
              }
            },
          },
        )
      } else {
        setVotedFor(personaje.slug)
        incrementarContadorLocalVotos()
        toast.success(`+${personaje.nombre}`, {
          description: 'Modo casual · sin torneo activo',
        })
        if (fastMode) {
          // Mismo patrón que modo backend (línea 220): asignar a la ref para
          // que handleNext() manual o el cleanup del unmount puedan cancelar.
          // Sin esto, pulsar siguiente antes del auto-next o desmontar la
          // página dispara doble salto / setState en componente desmontado.
          autoNextTimeoutRef.current = setTimeout(() => {
            autoNextTimeoutRef.current = null
            handleNext()
          }, NEXT_DELAY_MS)
        }
      }
    },
    [play, modoBackend, user, navigate, votarMutation, matchId, fastMode, handleNext, votedFor],
  )

  // Cleanup: si el componente se desmonta mientras hay un auto-next
  // pendiente, lo cancelamos para evitar setState en componente
  // desmontado + memory leak. Empty deps porque solo nos importa el
  // unmount.
  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current != null) {
        clearTimeout(autoNextTimeoutRef.current)
      }
    }
  }, [])

  // Atajos de teclado: ← vota izquierda, → derecha, S saltar, Espacio
  // siguiente si ya votó. Solo activos cuando el usuario no está en un
  // input — el check `tagName` evita atrapar tecla cuando se escribe en
  // otro sitio de la UI (no debería haberlos en /votar pero defensivo).
  useEffect(() => {
    if (isLoading || !a || !b) return
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleVote(a)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleVote(b)
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleNext()
      } else if (e.key === ' ' && votedFor) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLoading, a, b, handleVote, handleNext, votedFor])

  if (isLoading) {
    return (
      <VisualPageShell
        visual={{ ...BRAND_VISUALS.torneos, kanji: '闘' }}
        className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
        contentClassName="flex flex-col items-center gap-3"
        lateralKanji={null}
      >
        <KanjiSpinner kanji="闘" size="lg" tone="accent" />
        <p className="text-[12px] uppercase tracking-[0.18em] text-fg-muted">
          Preparando duelo…
        </p>
      </VisualPageShell>
    )
  }

  return (
    <VisualPageShell
      visual={{ ...BRAND_VISUALS.torneos, kanji: '闘' }}
      contentClassName="mx-auto flex max-w-5xl flex-col gap-4"
      lateralKanji={{ left: '挑', right: '闘' }}
      className="py-6 sm:py-10"
      atmosphere="arena-storm"
    >
        {/* Top bar: badge + modo rápido + skip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {modoBackend
              ? 'Match en juego · En vivo'
              : modoSugerido
                ? `Duelo ELO equilibrado · Δ ${dueloSugerido.eloDiff}`
                : 'Enfrentamiento aleatorio'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFastMode((f) => !f)}
              aria-pressed={fastMode}
              title={fastMode ? 'Auto-siguiente activo · clic para desactivar' : 'Auto-siguiente desactivado · clic para activar'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                fastMode
                  ? 'border-yellow-400/60 bg-yellow-500/10 text-yellow-200'
                  : 'border-border bg-surface text-fg-muted hover:border-yellow-400/40 hover:text-yellow-200'
              }`}
            >
              <Zap className={`h-3.5 w-3.5 ${fastMode ? 'fill-yellow-300' : ''}`} />
              Modo rápido
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isFetching || isFetchingDueloSugerido}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-gold disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
              {votedFor ? 'Siguiente duelo' : 'Saltar duelo'}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Pregunta principal */}
        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold leading-tight tracking-tight">
            ¿A quién prefieres?
          </h1>
          <p className="max-w-xl text-[13px] text-fg-muted">
            {modoBackend
              ? votoInvitadoActivo
                ? 'Puedes votar 5 duelos como invitado; crea cuenta para guardar tu historial'
                : 'Tu voto cuenta para el bracket en directo · cada duelo mueve el ELO'
              : sinMatchesAbiertos
                ? 'No hay torneos en juego — te proponemos pares de ELO similar'
                : 'Elige quién gana este duelo y ayuda a mover el ranking ELO'}
          </p>
        </header>

        {votoInvitadoActivo && (
          <div className="rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-center text-[13px] font-medium text-gold">
            Voto invitado activo: los primeros {ANON_VOTE_LIMIT} votos cuentan con peso 0.3.
            <Link to="/login?next=%2Fvotar" className="ml-1 underline decoration-gold/50 underline-offset-4 hover:text-fg-strong">
              Entra para peso completo y guardar historial.
            </Link>
          </div>
        )}

        {/* Arena */}
        <motion.div
          key={`${a.slug}-${b.slug}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 sm:gap-6"
        >
          <VoteCard
            personaje={a}
            onClick={() => handleVote(a)}
            isVoted={votedFor === a.slug}
            isLoser={votedFor && votedFor !== a.slug}
            showResult={Boolean(votedFor)}
            side="left"
            anonymousLimited={votoInvitadoActivo}
            voteResult={voteResult?.ganadorSlug === a.slug ? voteResult : null}
          />
          <VsBadge votedFor={votedFor} />
          <VoteCard
            personaje={b}
            onClick={() => handleVote(b)}
            isVoted={votedFor === b.slug}
            isLoser={votedFor && votedFor !== b.slug}
            showResult={Boolean(votedFor)}
            side="right"
            anonymousLimited={votoInvitadoActivo}
            voteResult={voteResult?.ganadorSlug === b.slug ? voteResult : null}
          />
        </motion.div>

        {/* Atajos + (en sin matches) link a torneos */}
        <div className="flex flex-col items-center gap-2">
          <p className="hidden text-[11px] uppercase tracking-[0.15em] text-fg-muted sm:block">
            Atajos:{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              ←
            </kbd>{' '}
            izquierda ·{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              →
            </kbd>{' '}
            derecha ·{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              S
            </kbd>{' '}
            saltar
            {votedFor && (
              <>
                {' '}·{' '}
                <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
                  Espacio
                </kbd>{' '}
                siguiente
              </>
            )}
          </p>
          {sinMatchesAbiertos && (
            <Link
              to="/torneos"
              className="text-[12px] text-gold hover:underline"
            >
              Ver torneos disponibles →
            </Link>
          )}
        </div>
        <AnonVoteLimitModal
          open={showAnonLimitModal}
          onClose={() => setShowAnonLimitModal(false)}
        />
    </VisualPageShell>
  )
}

function VsBadge({ votedFor }) {
  const reduceMotion = useReducedMotion()
  // Audit perf (2026-05-22): la animación infinita scale[1,1.06,1] cada 1.8s
  // forzaba recomposición del badge cada frame durante TODA la sesión, aún
  // cuando el usuario no había interactuado. Si el user respeta
  // prefers-reduced-motion la quitamos del todo; en el resto la mantenemos
  // pero con duración más larga (2.6s) para reducir frame churn.
  return (
    <motion.div
      animate={
        votedFor
          ? reduceMotion
            ? { scale: 1.1 }
            : { scale: [1, 1.25, 1], rotate: [0, 8, -8, 0] }
          : reduceMotion
            ? { scale: 1 }
            : { scale: [1, 1.06, 1] }
      }
      transition={{
        duration: votedFor ? 0.5 : 2.6,
        repeat: votedFor || reduceMotion ? 0 : Infinity,
        ease: 'easeInOut',
      }}
      className="relative flex h-14 w-14 items-center justify-center justify-self-center rounded-full border-2 border-accent bg-accent-soft text-gold shadow-[0_0_40px_-10px_rgba(255,46,99,0.7)] sm:h-20 sm:w-20"
    >
      <Swords className="h-5 w-5 sm:h-7 sm:w-7" />
      <span className="absolute -bottom-6 font-mono text-[10px] font-extrabold uppercase tracking-[0.25em] text-gold">
        VS
      </span>
    </motion.div>
  )
}

function VoteCard({ personaje, onClick, isVoted, isLoser, showResult, side, anonymousLimited, voteResult }) {
  const imgSrc = personaje.imagenUrl ?? imagenPersonaje(personaje.slug)
  const dominantColor = personaje.imagenColorDominante ?? '#151923'
  // warm() en hover: anticipa que el user va a hacer click y resume el
  // AudioContext si estaba suspended. Sin esto el primer playVote tras
  // inactividad de pestaña tenía 50-200ms de lag mientras resolvía
  // ctx.resume() ANTES de programar los oscillators.
  const { warm } = useSound()
  const reduceMotion = useReducedMotion()
  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={onClick}
        onPointerEnter={warm}
        onFocus={warm}
        disabled={showResult}
        // Audit perf (2026-05-22): los keyframes scale[1,1.08,1] +
        // boxShadow[3 keyframes] al votar generaban 3 transiciones simultáneas
        // sobre una card de 400px; combinado con el blur del letterbox
        // disparaba 30+ms/frame durante 560ms. Mantenemos el pop con un
        // single-step scale 1.05 + boxShadow estático (CSS transitions ya
        // gestionan el easing).
        animate={
          isVoted
            ? { scale: reduceMotion ? 1 : 1.05 }
            : { scale: 1 }
        }
        transition={{ duration: reduceMotion ? 0.18 : 0.32, ease: 'easeOut' }}
        aria-label={
          anonymousLimited
            ? `Votar como invitado por ${personaje.nombre} de ${personaje.anime}`
            : `Votar por ${personaje.nombre} de ${personaje.anime}`
        }
        // transition: solo las props que realmente cambian, no `all`.
        // `all` reanimaba TODO (filtros, fondos, padding...) en cada
        // hover/repaint, agitando el compositor en una página con dos
        // cards + dos letterboxes a la vez. Coste: del 30%-50% de un
        // frame en cards medianas según DevTools Performance.
        className={`group relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface transition-[transform,border-color,box-shadow,opacity,filter] ${
          isVoted
            ? 'border-accent shadow-[0_0_60px_-10px_rgba(255,46,99,0.7)] ring-2 ring-accent/40'
            : isLoser
              ? 'border-border opacity-40 grayscale'
              : 'border-border hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_0_40px_-15px_rgba(255,46,99,0.55)]'
        } disabled:cursor-default`}
      >
        <div
          className="relative aspect-[2/3] max-h-[55vh] w-full overflow-hidden"
          style={{ backgroundColor: dominantColor }}
        >
          {/* Letterbox del fondo:
              - Antes: blur(48px) + scale(1.4) era brutal en repaint
                (~10-15ms/frame). Pasó a blur(24px) + scale(1.2) + GPU layer.
              - Audit perf (2026-05-22): aun a 24px, en 2 cards a la vez +
                hover scale + voto animation, el repaint del blur seguía
                siendo el principal bottleneck según devtools. Bajamos a
                blur(18px) + scale(1.1) (menos área a re-blurear) y opacity
                0.55 para que el efecto se note menos al simplificarse.
                contain:strict aísla el layer del compositor — los repaints
                de la card no propagan al letterbox de la otra.
              - dominantColor sigue ahí abajo como fondo de respaldo si
                el blur tarda en pintar al primer frame. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 motion-reduce:hidden"
            style={{
              backgroundImage: `url(${imgSrc})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(18px)',
              transform: 'scale(1.1)',
              opacity: 0.55,
              willChange: 'filter',
              contain: 'strict',
            }}
          />
          <img
            src={imgSrc}
            alt={personaje.nombre}
            loading="eager"
            decoding="async"
            className="relative h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {isVoted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4"
            >
              <span className="rounded-full border-2 border-accent bg-black/70 px-3 py-1 font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold backdrop-blur-sm">
                ✓ Tu voto
              </span>
            </motion.div>
          )}
          <VoteFeedbackBurst
            active={Boolean(voteResult)}
            delta={voteResult?.delta}
            value={voteResult?.votosGanador}
            label="ELO actualizado"
          />
          {anonymousLimited && !showResult && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-gold/50 bg-black/70 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-gold backdrop-blur-sm">
              Voto invitado
            </div>
          )}
        </div>
      </motion.button>
      {/* Info debajo de la card — comparación rápida sin overlay sobre la
          imagen. Nombre + anime + (solo tras votar) link discreto a la ficha. */}
      <div
        className={`flex min-w-0 flex-col items-${side === 'right' ? 'end' : 'start'} px-1 text-${side === 'right' ? 'right' : 'left'}`}
      >
        <h2 className="line-clamp-1 w-full text-base font-bold text-fg-strong sm:text-lg">
          {personaje.nombre}
        </h2>
        <p className="line-clamp-1 w-full text-[12px] text-fg-muted">
          {personaje.anime}
        </p>
        {showResult && (
          <Link
            to={`/personajes/${personaje.slug}`}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
          >
            Ver ficha
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

function AnonVoteLimitModal({ open, onClose }) {
  const next = encodeURIComponent('/votar')
  // Audit F018 (2026-05-22): este modal antes era un <div role="dialog">
  // sin focus trap, Escape, bloqueo de scroll ni restore de foco. Migrado
  // al componente AccessibleDialog que centraliza todos esos detalles.
  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      titleId="anon-vote-limit-title"
      panelClassName="border-gold/40 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full border border-border bg-surface p-2 text-fg-muted transition-colors hover:border-gold/50 hover:text-gold"
        aria-label="Cerrar aviso de límite invitado"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 bg-gold/15 text-gold">
        <LogIn className="h-5 w-5" />
      </div>
      <h2 id="anon-vote-limit-title" className="text-2xl font-black text-fg-strong">
        Crea cuenta gratis para seguir votando
      </h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Ya usaste tus 5 votos invitados. Al entrar, esos votos se migran a tu
        perfil y aparecen en Mi historial.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href={`${api.base}/oauth2/authorization/google?next=${next}`}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-gold/60 hover:text-gold"
        >
          Google
        </a>
        <a
          href={`${api.base}/oauth2/authorization/discord?next=${next}`}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3 text-sm font-bold text-fg-strong transition-colors hover:border-violet-400/60 hover:text-violet-200"
        >
          Discord
        </a>
      </div>
      <Link
        to="/login?next=%2Fvotar"
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gold px-4 py-3 text-sm font-black text-bg transition-transform hover:scale-[1.01]"
      >
        Entrar con email
      </Link>
    </AccessibleDialog>
  )
}

export default VotarPage
