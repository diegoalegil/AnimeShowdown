import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, EyeOff, Scale, SkipForward, Swords, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { endpoints, ApiError } from '../lib/api'
import {
  getAnonymousVotesCount,
  incrementAnonymousVotesCount,
} from '../lib/anonymousVoting'
import { useSeo } from '../hooks/useSeo'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { useSound } from '../contexts/SoundContext'
import { useAuth } from '../contexts/AuthContext'
import { VisualPageShell } from '../components/VisualSystem'
import KanjiSpinner from '../components/KanjiSpinner'
import { BRAND_VISUALS } from '../data/visual-assets'
import DailyMissionPanel from '../components/DailyMissionPanel'
import { recordDailyShare } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'
import { shareWithToast } from '../lib/shareWithToast'
import AnonVoteLimitModal from '../features/votar/components/AnonVoteLimitModal'
import SessionRecap from '../features/votar/components/SessionRecap'
import VoteArena from '../features/votar/components/VoteArena'
import { useMisEspeciales } from '../hooks/useCartas'
import VotarQuickModes from '../features/votar/components/VotarQuickModes'
import { useVoteKeyboardShortcuts } from '../features/votar/hooks/useVoteKeyboardShortcuts'
import { useVoteSessionStats } from '../features/votar/hooks/useVoteSessionStats'
import {
  getPairFromAnime,
  getPairWithFixed,
  pairKey,
  recordRecentPair,
  selectRandomPair,
} from '../features/votar/vote-pairing'
import { formatPersonalVoteImpact, formatVoteScore } from '../features/votar/vote-format'
import { incrementarContadorLocalVotos } from '../features/votar/vote-local-counter'
import { getArenaDescription, getArenaStatusLabel } from '../features/votar/arena-labels'

// Claves y tiempo de vida para el prefetch del siguiente par.
// gcTime de 8s: suficiente para que el usuario vea el resultado y avance.
const BACKEND_QUERY_KEY = ['enfrentamientos', 'siguiente']
const PREFETCH_BACKEND_KEY = ['enfrentamientos', 'prefetch-siguiente']
const PREFETCH_SUGERIDO_KEY = ['votar', 'duelo-sugerido-prefetch']
const PREFETCH_GC_TIME = 8_000

// El captcha modal lazy-load el script de Cloudflare Turnstile la primera
// vez. La mayoría de usuarios nunca caen en captcha, así que mantenemos
// el bundle inicial sin ese coste.
const CaptchaModal = lazy(() => import('../components/CaptchaModal'))

/**
 * VotarPage — arena de duelo rápido.
 *
 * Pantalla diseñada para que todo el duelo quepa sin scroll:
 *   - Cards con max-h 55vh + object-contain (no recorta) + letterbox
 *     ligero con color dominante. Evitamos blur en tiempo real porque
 *     castigaba el frame rate de la arena.
 *   - VS central grande con glow magenta.
 *   - "Saltar" arriba a la derecha, siempre visible.
 *   - Nombre + anime debajo de cada card (no overlay) → comparación rápida.
 *   - Atajos de teclado: ← vota izquierda, → derecha, S saltar, Espacio
 *     siguiente cuando ya hay voto.
 *   - Modo rápido (toggle): tras votar carga el siguiente duelo automáticamente.
 *
 * Mantiene el modo híbrido del backend (match real si hay torneo, casual
 * con pares random local si no).
 */

const STORAGE_FAST = 'animeshowdown.votar.fast'
const STORAGE_BLIND = 'animeshowdown.votar.blind'
const ANON_VOTE_LIMIT = 5
const TIE_VOTE_KEY = '__empate__'
// Pausa breve entre voto y siguiente duelo. En una pantalla de juego, 1.8s
// se percibía como bloqueo; ~0.9s conserva feedback y mantiene ritmo.
const NEXT_DELAY_MS = 900

function hasPrefetchReadyOrRunning(queryClient, queryKey) {
  const state = queryClient.getQueryState(queryKey)
  return state?.fetchStatus === 'fetching' || queryClient.getQueryData(queryKey) != null
}

/**
 * Barra split cabeza-a-cabeza con porcentajes: resalta mayoría (ganador)
 * y minoría (perdedor). Se muestra solo cuando el backend devuelve ambos
 * totales de votos.
 */
function HeadToHeadBar({ ganadorNombre, perdedorNombre, votosGanador, votosPerdedor }) {
  const total = votosGanador + votosPerdedor
  if (total <= 0) return null
  const pctGanador = Math.round((votosGanador / total) * 100)
  const pctPerdedor = 100 - pctGanador
  const esCercano = pctGanador < 60 // consideramos "polémico" si el ganador tiene < 60%
  return (
    <div className="mt-2 w-full">
      <div className="mb-1 flex justify-between text-[11px] font-black">
        <span className="text-fg-strong">{ganadorNombre}</span>
        <span className="text-fg-muted">{perdedorNombre}</span>
      </div>
      <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-l-full bg-accent transition-all duration-500"
          style={{ width: `${pctGanador}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold">
        <span className="text-danger">{pctGanador}%</span>
        {esCercano && (
          <span className="text-center text-[10px] font-bold text-fg-muted">
            ¡Duelo reñido!
          </span>
        )}
        <span className="text-fg-muted">{pctPerdedor}%</span>
      </div>
    </div>
  )
}

/**
 * MobileExtrasToggle — visible solo en móvil (sm:hidden).
 * Muestra un botón compacto que expande/contrae VotarQuickModes y
 * DailyMissionPanel para que la arena + resultado quepan sin scroll.
 */
function MobileExtrasToggle({
  a,
  b,
  fixedAnime,
  fixedPersonaje,
  exactDuelActive,
  hasFixedAnime,
  blindMode,
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent/40 hover:text-fg-strong"
        aria-expanded={open}
      >
        <span>{open ? 'Ocultar opciones' : 'Más opciones'}</span>
        <span aria-hidden="true" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <VotarQuickModes
            a={a}
            b={b}
            fixedAnime={fixedAnime}
            fixedPersonaje={fixedPersonaje}
            hasFixedDuel={exactDuelActive}
            hasFixedAnime={hasFixedAnime}
            blindMode={blindMode}
          />
          <DailyMissionPanel compact />
        </div>
      )}
    </div>
  )
}

function VotarPage() {
  useSeo({
    title: 'Votar',
    description:
      'Arena de duelos: elige al ganador de cada enfrentamiento entre personajes anime y mueve el ranking ELO de AnimeShowdown.',
  })
  const { play } = useSound()
  const { user } = useAuth()
  const { data: misEspeciales } = useMisEspeciales()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const fixedSlug = searchParams.get('personaje')
  const fixedRivalSlug = searchParams.get('rival')
  const fixedAnime = searchParams.get('anime')
  const fixedPersonaje = useMemo(
    () => catalogoPersonajes.find((p) => p.slug === fixedSlug) ?? null,
    [catalogoPersonajes, fixedSlug],
  )
  const fixedRival = useMemo(
    () =>
      catalogoPersonajes.find((p) => p.slug === fixedRivalSlug && p.slug !== fixedSlug) ?? null,
    [catalogoPersonajes, fixedRivalSlug, fixedSlug],
  )
  const hasFixedDuel = Boolean(fixedPersonaje && fixedRival)
  const hasFixedAnime = useMemo(
    () =>
      !fixedPersonaje &&
      Boolean(fixedAnime) &&
      catalogoPersonajes.filter((p) => p.anime === fixedAnime).length >= 2,
    [catalogoPersonajes, fixedAnime, fixedPersonaje],
  )
  const casualContextKey = `${fixedSlug || ''}::${fixedRivalSlug || ''}::${fixedAnime || ''}`
  const authenticatedUserId = user?.id ?? null
  const seenBackendPairsRef = useRef(new Set())
  const seenBackendMatchIdsRef = useRef(new Set())
  const fetchSiguienteBackend = useCallback(() => {
    const excludeIds = Array.from(seenBackendMatchIdsRef.current).slice(-100)
    const anonymous = authenticatedUserId == null
    return endpoints.enfrentamientoSiguiente({
      excludeIds,
      anonymous,
    })
  }, [authenticatedUserId])

  const {
    data: enfrentamiento,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: BACKEND_QUERY_KEY,
    queryFn: fetchSiguienteBackend,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const [casualPairOverride, setCasualPairOverride] = useState(null)
  const [votedFor, setVotedFor] = useState(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
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
  const [blindMode, setBlindMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_BLIND) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAST, String(fastMode))
    } catch {
      // ignore
    }
  }, [fastMode])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BLIND, String(blindMode))
    } catch {
      // ignore
    }
  }, [blindMode])

  // Resultado del último voto registrado: el backend devuelve delta + votos
  // post-voto. Sirve para pintar el overlay "+1 ELO" sobre la card ganadora.
  // Se resetea cuando llega un nuevo enfrentamiento o tras saltar.
  const [voteResult, setVoteResult] = useState(null)
  const [showAnonLimitModal, setShowAnonLimitModal] = useState(false)
  // Cuando el backend devuelve 428, guardamos el voto pendiente (sitekey,
  // ids del enfrentamiento y personaje) y abrimos el captcha modal. Tras
  // éxito, re-emitimos la mutation con el header X-AS-Captcha-Token.
  const [captchaChallenge, setCaptchaChallenge] = useState(null)

  // Ref sincronizada con fastMode para que handleVoteSuccess pueda leerlo
  // sin necesitar regenerarse en cada toggle.
  const fastModeRef = useRef(fastMode)
  useEffect(() => {
    fastModeRef.current = fastMode
  }, [fastMode])

  // Ref para cancelar el timeout de auto-next si el usuario pulsa
  // "Siguiente duelo" antes de que dispare o si el componente se desmonta.
  const autoNextTimeoutRef = useRef(null)
  const handleNextRef = useRef(null)
  const voteLockedRef = useRef(false)
  const isVotePendingRef = useRef(false)
  const isAdvancingRef = useRef(false)
  const currentPairKeyRef = useRef('')
  const recordedPairKeyRef = useRef('')
  const warmPrefetchPairKeyRef = useRef('')

  useEffect(() => {
    if (fastMode || autoNextTimeoutRef.current == null) return
    clearTimeout(autoNextTimeoutRef.current)
    autoNextTimeoutRef.current = null
  }, [fastMode])

  const votarMutation = useMutation({
    mutationFn: ({ enfrentamientoId, personajeGanadorId, anonymous, captchaToken, empate }) => {
      // Si tenemos token Turnstile, viajará en el header
      // X-AS-Captcha-Token. El backend lo verifica antes de aplicar el
      // throttle de captcha.
      const headers = {}
      if (captchaToken) headers['X-AS-Captcha-Token'] = captchaToken
      return endpoints.votar(enfrentamientoId, personajeGanadorId, {
        anonymous,
        headers,
        empate,
      })
    },
    // Sin invalidateQueries(['torneos']) por voto: refetcheaba toda la lista de
    // torneos en CADA voto sin necesidad. El bracket y el ranking en vivo se
    // mueven por WebSocket (BracketUpdate/RankingDelta), no por refetch del REST.
  })
  const isVotePending = votarMutation.isPending
  useEffect(() => {
    isVotePendingRef.current = isVotePending
  }, [isVotePending])

  useEffect(() => {
    isAdvancingRef.current = isAdvancing
  }, [isAdvancing])

  const modoBackend = !fixedPersonaje && !hasFixedAnime && Boolean(enfrentamiento && !isError)
  const sinMatchesAbiertos =
    isError && error instanceof ApiError && error.status === 404
  const canUseLocalCatalog = catalogoPersonajes.length >= 2
  const {
    data: dueloSugerido,
    refetch: refetchDueloSugerido,
    isFetching: isFetchingDueloSugerido,
  } = useQuery({
    queryKey: ['votar', 'duelo-sugerido'],
    queryFn: endpoints.dueloSugerido,
    enabled: !fixedPersonaje && !hasFixedAnime && !isLoading && !modoBackend && !canUseLocalCatalog,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const modoSugerido = Boolean(
    !fixedPersonaje &&
      !hasFixedAnime &&
      !modoBackend &&
      !canUseLocalCatalog &&
      dueloSugerido?.personaje1 &&
      dueloSugerido?.personaje2,
  )
  const shouldUseCasualPair =
    Boolean(fixedPersonaje) || hasFixedAnime || (!modoBackend && canUseLocalCatalog)
  const casualPair = useMemo(() => {
    if (!shouldUseCasualPair) return [null, null]
    if (
      casualPairOverride?.key === casualContextKey &&
      casualPairOverride?.pair?.[0] &&
      casualPairOverride?.pair?.[1]
    ) {
      return casualPairOverride.pair
    }
    if (catalogoPersonajes.length < 2) return [null, null]
    if (hasFixedDuel) return [fixedPersonaje, fixedRival]
    if (fixedPersonaje) return getPairWithFixed(catalogoPersonajes, fixedPersonaje)
    if (hasFixedAnime) return getPairFromAnime(catalogoPersonajes, fixedAnime)
    return selectRandomPair(catalogoPersonajes)
  }, [catalogoPersonajes, casualContextKey, casualPairOverride, fixedAnime, fixedPersonaje, fixedRival, hasFixedAnime, hasFixedDuel, shouldUseCasualPair])
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

  const currentPairKey = a?.slug && b?.slug ? pairKey(a.slug, b.slug) : ''
  const exactDuelActive =
    hasFixedDuel &&
    a?.slug &&
    b?.slug &&
    pairKey(a.slug, b.slug) === pairKey(fixedPersonaje.slug, fixedRival.slug)

  useEffect(() => {
    currentPairKeyRef.current = currentPairKey
  }, [currentPairKey])

  useEffect(() => {
    if (!a?.slug || !b?.slug || !currentPairKey) return
    if (recordedPairKeyRef.current === currentPairKey) return
    recordRecentPair(a.slug, b.slug)
    if (matchId != null) {
      seenBackendMatchIdsRef.current.add(Number(matchId))
    }
    // Registrar en el Set de dedup de sesión para modo backend.
    seenBackendPairsRef.current.add(currentPairKey)
    recordedPairKeyRef.current = currentPairKey
  }, [a?.slug, b?.slug, currentPairKey, matchId])

  const tieSelected = votedFor === TIE_VOTE_KEY
  const votedPersonaje = votedFor === a?.slug ? a : votedFor === b?.slug ? b : null
  const losingPersonaje = votedFor === a?.slug ? b : votedFor === b?.slug ? a : null
  const {
    sessionStats,
    personalVoteImpact,
    setPersonalVoteImpact,
    trackLocalVote,
  } = useVoteSessionStats()

  // Prefetch del siguiente par en background. Se dispara al mostrar el duelo y
  // se reusa tras votar, de modo que el auto-next no dependa de la ventana de
  // animación (~900ms) para empezar a pedir el siguiente match.
  const prefetchSiguientePar = useCallback(() => {
    if (modoBackend) {
      if (hasPrefetchReadyOrRunning(queryClient, PREFETCH_BACKEND_KEY)) return
      queryClient.prefetchQuery({
        queryKey: PREFETCH_BACKEND_KEY,
        queryFn: fetchSiguienteBackend,
        staleTime: 0,
        gcTime: PREFETCH_GC_TIME,
      })
    } else if (modoSugerido) {
      if (hasPrefetchReadyOrRunning(queryClient, PREFETCH_SUGERIDO_KEY)) return
      queryClient.prefetchQuery({
        queryKey: PREFETCH_SUGERIDO_KEY,
        queryFn: endpoints.dueloSugerido,
        staleTime: 0,
        gcTime: PREFETCH_GC_TIME,
      })
    }
    // Modo casual es instantáneo (solo estado local), no necesita prefetch.
  }, [fetchSiguienteBackend, modoBackend, modoSugerido, queryClient])

  useEffect(() => {
    if (!currentPairKey || votedFor || isAdvancing || isVotePending) return
    if (!modoBackend && !modoSugerido) return
    if (warmPrefetchPairKeyRef.current === currentPairKey) return
    warmPrefetchPairKeyRef.current = currentPairKey
    prefetchSiguientePar()
  }, [
    currentPairKey,
    isAdvancing,
    isVotePending,
    modoBackend,
    modoSugerido,
    prefetchSiguientePar,
    votedFor,
  ])

  const handleNext = useCallback(async (options = {}) => {
    const force = options?.force === true
    if (isAdvancingRef.current || (!force && isVotePendingRef.current)) return
    const silent = options?.silent === true
    // Cancela cualquier auto-next pendiente — el user pulsó manual
    // antes del timeout, no queremos saltar dos matches.
    if (autoNextTimeoutRef.current != null) {
      clearTimeout(autoNextTimeoutRef.current)
      autoNextTimeoutRef.current = null
    }
    if (!silent) play('playClick')
    setIsAdvancing(true)
    setVotedFor(null)
    setVoteResult(null)
    setPersonalVoteImpact(null)
    try {
      const previousKey = currentPairKeyRef.current
      if (modoBackend) {
        // Si hay datos pre-cargados del siguiente par, los inyectamos
        // directamente en la query principal para transición instantánea.
        const prefetchedData = queryClient.getQueryData(PREFETCH_BACKEND_KEY)
        const prefetchedKey =
          prefetchedData?.personaje1?.slug && prefetchedData?.personaje2?.slug
            ? pairKey(prefetchedData.personaje1.slug, prefetchedData.personaje2.slug)
            : ''
        // Usar prefetch solo si el match es nuevo (no visto en esta sesión).
        const prefetchedId = Number(prefetchedData?.id)
        const prefetchIsNew =
          prefetchedKey &&
          Number.isInteger(prefetchedId) &&
          !seenBackendMatchIdsRef.current.has(prefetchedId) &&
          !seenBackendPairsRef.current.has(prefetchedKey)
        if (prefetchedData && prefetchIsNew) {
          queryClient.setQueryData(BACKEND_QUERY_KEY, prefetchedData)
          queryClient.removeQueries({ queryKey: PREFETCH_BACKEND_KEY })
        } else {
          if (prefetchedData) {
            queryClient.removeQueries({ queryKey: PREFETCH_BACKEND_KEY })
          }
          await refetch()
        }
      } else if (modoSugerido) {
        const prefetchedData = queryClient.getQueryData(PREFETCH_SUGERIDO_KEY)
        const prefetchedKey =
          prefetchedData?.personaje1?.slug && prefetchedData?.personaje2?.slug
            ? pairKey(prefetchedData.personaje1.slug, prefetchedData.personaje2.slug)
            : ''
        if (prefetchedData && prefetchedKey && prefetchedKey !== previousKey) {
          queryClient.setQueryData(['votar', 'duelo-sugerido'], prefetchedData)
          queryClient.removeQueries({ queryKey: PREFETCH_SUGERIDO_KEY })
        } else {
          if (prefetchedData) {
            queryClient.removeQueries({ queryKey: PREFETCH_SUGERIDO_KEY })
          }
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const result = await refetchDueloSugerido()
            const nextKey =
              result?.data?.personaje1?.slug && result?.data?.personaje2?.slug
                ? pairKey(result.data.personaje1.slug, result.data.personaje2.slug)
                : ''
            if (nextKey && nextKey !== previousKey) break
          }
        }
      } else {
        setCasualPairOverride({
          key: casualContextKey,
          pair: hasFixedDuel
            ? [fixedPersonaje, fixedRival]
            : fixedPersonaje
            ? getPairWithFixed(catalogoPersonajes, fixedPersonaje)
            : hasFixedAnime
              ? getPairFromAnime(catalogoPersonajes, fixedAnime)
              : selectRandomPair(catalogoPersonajes),
        })
      }
    } finally {
      voteLockedRef.current = false
      setIsAdvancing(false)
    }
  }, [
    play,
    modoBackend,
    modoSugerido,
    queryClient,
    refetch,
    refetchDueloSugerido,
    casualContextKey,
    catalogoPersonajes,
    fixedAnime,
    fixedPersonaje,
    fixedRival,
    hasFixedDuel,
    hasFixedAnime,
    setPersonalVoteImpact,
  ])

  useEffect(() => {
    handleNextRef.current = handleNext
  }, [handleNext])

  const scheduleAutoNext = useCallback(() => {
    if (!fastMode) return
    if (autoNextTimeoutRef.current != null) {
      clearTimeout(autoNextTimeoutRef.current)
    }
    autoNextTimeoutRef.current = setTimeout(() => {
      autoNextTimeoutRef.current = null
      handleNextRef.current?.({ silent: true, force: true })
    }, NEXT_DELAY_MS)
  }, [fastMode])

  // "+N monedas": el backend devuelve en la respuesta del voto las monedas que
  // va a acreditar (misión diaria + hito cada N votos). Solo ocurre en votos
  // concretos (primero del día, cada 10º) → es un premio puntual, no ruido, así
  // que el toast se muestra también en modo rápido. Refrescamos el saldo del
  // header tras el drop async (el listener lo acredita justo tras el commit).
  const notifyCoins = useCallback(
    (data) => {
      const monedas = data?.monedasGanadas ?? 0
      if (monedas <= 0) return
      toast.success(`+${monedas} monedas`, {
        description: 'Gástalas en sobres de cartas.',
      })
      // El header cuadra con el toast al instante (optimista). El crédito real lo
      // aplica el listener async tras el commit del voto, así que NO refetcheamos
      // de inmediato (leería el saldo viejo y el chip se quedaría desfasado);
      // reconciliamos con el servidor con un pequeño retardo, cuando el drop ya
      // aterrizó.
      queryClient.setQueryData(['monedero'], (old) =>
        old ? { ...old, saldo: (old.saldo ?? 0) + monedas } : old,
      )
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['monedero'] })
      }, 1500)
    },
    [queryClient],
  )

  const handleVoteSuccess = useCallback(
    (personaje, data, perdedor) => {
      if (data?.anonimo) {
        incrementAnonymousVotesCount()
      }
      incrementarContadorLocalVotos()
      const impact = trackLocalVote(personaje, perdedor, data)
      setVoteResult({
        ganadorSlug: personaje.slug,
        delta: data?.delta ?? 1,
        votosGanador: data?.votosGanador ?? null,
        votosPerdedor: data?.votosPerdedor ?? null,
      })

      // En modo rápido el auto-next salta cada ~900ms; el toast sería ruido
      // visual constante. Solo mostramos toast en modo normal o si es invitado
      // (necesita ver el contador de votos restantes).
      if (!fastModeRef.current || data?.anonimo) {
        const delta = data?.delta ?? 1
        const sufijo = delta === 1 ? 'voto' : 'votos'
        toast.success(`+${delta} ${sufijo} · ${personaje.nombre}`, {
          description: data?.votosGanador != null
            ? data?.anonimo
              ? `Voto invitado guardado · te quedan ${data.votosAnonimosRestantes ?? 0}${impact ? ` · #${impact.rank} en tu ranking` : ''}`
              : `Ahora suma ${formatVoteScore(data.votosGanador)} votos en este match${impact ? ` · #${impact.rank} en tu ranking` : ''}`
            : impact
              ? formatPersonalVoteImpact(impact)
              : 'Voto registrado · ranking actualizado',
        })
      }

      notifyCoins(data)

      // Prefetch del siguiente par mientras el usuario ve la animación de resultado.
      prefetchSiguientePar()
      scheduleAutoNext()
    },
    [scheduleAutoNext, trackLocalVote, prefetchSiguientePar, notifyCoins],
  )

  const handleTieVoteSuccess = useCallback(
    (data) => {
      if (data?.anonimo) {
        incrementAnonymousVotesCount()
      }
      incrementarContadorLocalVotos()
      setVoteResult({
        empate: true,
        ganadorSlug: TIE_VOTE_KEY,
        delta: 0.5,
        votosGanador: data?.votosGanador ?? null,
        votosPerdedor: data?.votosPerdedor ?? null,
      })
      if (!fastModeRef.current || data?.anonimo) {
        toast.success('Empate registrado', {
          description: data?.votosGanador != null && a && b
            ? `Medio voto para ${a.nombre} y medio para ${b.nombre}.`
            : 'No mueve el ELO: reparte medio voto a cada personaje.',
        })
      }
      notifyCoins(data)
      prefetchSiguientePar()
      scheduleAutoNext()
    },
    [a, b, prefetchSiguientePar, scheduleAutoNext, notifyCoins],
  )

  // "Reta a un amigo": comparte el duelo ACTUAL (a vs b) sin revelar tu voto,
  // para que el receptor aterrice votando ese mismo duelo. El middleware OG
  // pinta la card de duelo (/api/og/duelo/a/vs/b.png) en la preview social.
  const handleChallenge = useCallback(() => {
    if (!a?.slug || !b?.slug) return undefined
    return shareWithToast(
      {
        title: `Reto: ${a.nombre} vs ${b.nombre}`,
        text: `Te reto a este duelo en AnimeShowdown: ${a.nombre} (${a.anime}) vs ${b.nombre} (${b.anime}). ¿A quién subes tú?`,
        url: `/votar?personaje=${encodeURIComponent(a.slug)}&rival=${encodeURIComponent(b.slug)}`,
      },
      {
        nativeSuccess: 'Reto enviado',
        clipboardSuccess: 'Enlace de reto copiado',
        errorTitle: 'No se pudo compartir el reto',
      },
    )
  }, [a, b])

  const handleShareVote = useCallback(async () => {
    if (!votedPersonaje) return
    const personalLine = personalVoteImpact?.slug === votedPersonaje.slug
      ? `En mi ranking personal va #${personalVoteImpact.rank} con ${personalVoteImpact.count} votos míos.`
      : ''
    const baseShareText =
      sessionStats.lastShareText ||
      `Voté por ${votedPersonaje.nombre} en AnimeShowdown. ¿Tú a quién elegirías?`
    const text = [baseShareText, personalLine].filter(Boolean).join('\n')
    try {
      const result = await shareOrCopy({
        title: `${votedPersonaje.nombre} ganó mi duelo`,
        text,
        url: losingPersonaje?.slug
          ? `/votar?personaje=${encodeURIComponent(votedPersonaje.slug)}&rival=${encodeURIComponent(losingPersonaje.slug)}`
          : `/votar${
              fixedSlug
                ? `?personaje=${encodeURIComponent(fixedSlug)}`
                : fixedAnime
                  ? `?anime=${encodeURIComponent(fixedAnime)}`
                  : ''
            }`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Reto enviado' : 'Enlace de reto copiado')
    } catch (error) {
      toast.error('No se pudo compartir el reto', {
        description: error?.message || 'Copia el resultado manualmente.',
      })
    }
  }, [fixedAnime, fixedSlug, losingPersonaje, personalVoteImpact, sessionStats.lastShareText, votedPersonaje])

  const handleShareSessionRecap = useCallback(async () => {
    if (sessionStats.total <= 0) return
    const top = Object.values(sessionStats.bySlug || {})
      .sort((x, y) => y.count - x.count)
      .slice(0, 5)
      .map((p, index) => `${index + 1}. ${p.nombre} (${p.anime}) · x${p.count}`)
      .join('\n')
    const text = [
      `Llevo ${sessionStats.total} votos en AnimeShowdown hoy.`,
      top ? `Mi top de la sesión:\n${top}` : null,
      sessionStats.closeDuels > 0
        ? `${sessionStats.closeDuels} duelos estuvieron a 1 voto o menos.`
        : 'Todavía estoy buscando el duelo más polémico.',
      '¿A quién defenderías tú?',
    ].filter(Boolean).join('\n')
    try {
      const result = await shareOrCopy({
        title: 'Mi recap de votos anime',
        text,
        url: '/mi-ranking',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Recap compartido' : 'Recap copiado')
    } catch (error) {
      toast.error('No se pudo compartir el recap', {
        description: error?.message || 'Copia tu resumen manualmente.',
      })
    }
  }, [sessionStats])

  const handleVote = useCallback(
    (personaje) => {
      if (
        votedFor ||
        voteLockedRef.current ||
        isVotePendingRef.current ||
        isAdvancingRef.current
      ) {
        return
      }
      if (modoBackend && !user && getAnonymousVotesCount() >= ANON_VOTE_LIMIT) {
        setShowAnonLimitModal(true)
        toast.info('Límite invitado alcanzado', {
          description: 'Crea cuenta gratis para seguir votando y guardar tu racha.',
        })
        return
      }
      voteLockedRef.current = true
      // El sonido playVote ahora se dispara en onPointerDown desde VoteCard
      // vía useInstantSoundPress — feedback instantáneo sin esperar al onClick.

      if (modoBackend) {
        setVotedFor(personaje.slug)
        votarMutation.mutate(
          { enfrentamientoId: matchId, personajeGanadorId: personaje.id, anonymous: !user },
          {
            onSuccess: (data) => {
              handleVoteSuccess(personaje, data, personaje.id === a?.id ? b : a)
            },
            onError: (err) => {
              const status = err instanceof ApiError ? err.status : 0
              // 428 Precondition Required = el throttle antifraude pide
              // captcha. Body trae {captchaRequired, provider, sitekey}.
              // Guardamos el voto pendiente y abrimos el modal Turnstile.
              if (status === 428 && err?.body?.captchaRequired) {
                setCaptchaChallenge({
                  enfrentamientoId: matchId,
                  personajeId: personaje.id,
                  personajeNombre: personaje.nombre,
                  personajeSlug: personaje.slug,
                  personaje,
                  perdedor: personaje.id === a?.id ? b : a,
                  sitekey: err.body.sitekey || '',
                  anonymous: !user,
                })
                return
              }
              voteLockedRef.current = false
              setVotedFor(null)
              // 403 con retryAfterSeconds: throttle bloqueó 24h. Sin retry,
              // toast informativo y CTA suave a /login.
              if (status === 403 && err?.body?.retryAfterSeconds) {
                toast.error('Demasiados votos anónimos esta semana', {
                  description: 'Vuelve en 24h o crea cuenta gratis para seguir votando.',
                })
                return
              }
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
        setVoteResult({
          ganadorSlug: personaje.slug,
          delta: 1,
          votosGanador: null,
        })
        incrementarContadorLocalVotos()
        const impact = trackLocalVote(personaje, personaje.slug === a?.slug ? b : a, null)
        // En modo rápido suprimimos el toast casual — es ruido cuando el
        // auto-next salta cada ~900ms. El feedback visual de la arena es suficiente.
        if (!fastModeRef.current) {
          toast.success(`+${personaje.nombre}`, {
            description: impact
              ? formatPersonalVoteImpact(impact)
              : 'Modo casual · sin torneo activo',
          })
        }
        prefetchSiguientePar()
        scheduleAutoNext()
      }
    },
    [
      modoBackend,
      user,
      navigate,
      votarMutation,
      matchId,
      scheduleAutoNext,
      handleVoteSuccess,
      prefetchSiguientePar,
      votedFor,
      a,
      b,
      trackLocalVote,
    ],
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

  useVoteKeyboardShortcuts({
    a,
    b,
    captchaChallenge,
    handleNext,
    handleVote,
    isAdvancing,
    isFetching,
    isFetchingDueloSugerido,
    isLoading,
    isVotePending,
    showAnonLimitModal,
    votedFor,
  })

  const needsCasualPair = !modoBackend && !modoSugerido && (!a || !b)
  const controlsDisabled = isVotePending || isAdvancing || isFetching || isFetchingDueloSugerido
  const identitiesHidden = blindMode && !votedFor
  const handleVoteLeft = useCallback(() => {
    if (a) handleVote(a)
  }, [a, handleVote])
  const handleVoteRight = useCallback(() => {
    if (b) handleVote(b)
  }, [b, handleVote])
  const handleTieVote = useCallback(() => {
    if (
      !modoBackend ||
      !matchId ||
      votedFor ||
      voteLockedRef.current ||
      isVotePendingRef.current ||
      isAdvancingRef.current
    ) {
      return
    }
    if (!user && getAnonymousVotesCount() >= ANON_VOTE_LIMIT) {
      setShowAnonLimitModal(true)
      toast.info('Límite invitado alcanzado', {
        description: 'Crea cuenta gratis para seguir votando y guardar tu racha.',
      })
      return
    }
    voteLockedRef.current = true
    setVotedFor(TIE_VOTE_KEY)
    votarMutation.mutate(
      { enfrentamientoId: matchId, anonymous: !user, empate: true },
      {
        onSuccess: handleTieVoteSuccess,
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : 0
          if (status === 428 && err?.body?.captchaRequired) {
            setCaptchaChallenge({
              enfrentamientoId: matchId,
              empate: true,
              sitekey: err.body.sitekey || '',
              anonymous: !user,
            })
            return
          }
          voteLockedRef.current = false
          setVotedFor(null)
          if (status === 409) {
            toast.error('Ya votaste este enfrentamiento')
          } else if (status === 429 && !user) {
            setShowAnonLimitModal(true)
          } else {
            toast.error('No se pudo registrar el empate', {
              description: err?.message || 'Inténtalo de nuevo.',
            })
          }
        },
      },
    )
  }, [modoBackend, matchId, votedFor, user, votarMutation, handleTieVoteSuccess])

  const arenaStatusLabel = getArenaStatusLabel({
    modoBackend,
    exactDuelActive,
    identitiesHidden,
    fixedPersonaje,
    fixedRival,
    hasFixedAnime,
    fixedAnime,
    modoSugerido,
    dueloSugerido,
  })
  const arenaDescription = getArenaDescription({
    modoBackend,
    votoInvitadoActivo,
    identitiesHidden,
    sinMatchesAbiertos,
    exactDuelActive,
    fixedPersonaje,
    fixedRival,
    hasFixedAnime,
    fixedAnime,
  })

  if ((!fixedPersonaje && !hasFixedAnime && isLoading) || needsCasualPair) {
    return (
      <VisualPageShell
        visual={{ ...BRAND_VISUALS.torneos, kanji: '闘' }}
        className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
        contentClassName="flex flex-col items-center gap-3"
        lateralKanji={null}
      >
        <KanjiSpinner kanji="闘" size="lg" tone="accent" />
        <p className="text-[12px] text-fg-muted">
          Preparando duelo…
        </p>
      </VisualPageShell>
    )
  }

  return (
    <VisualPageShell
      visual={{ ...BRAND_VISUALS.torneos, kanji: '闘' }}
      contentClassName="mx-auto flex max-w-5xl flex-col gap-3 sm:gap-4"
      lateralKanji={{ left: '挑', right: '闘' }}
      className="min-h-[calc(100svh-5rem)] py-3 sm:py-8 lg:py-10"
      atmosphere="arena-storm"
    >
        {/* Top bar: badge + modo rápido + skip */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold text-fg-muted sm:text-[11px]">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {arenaStatusLabel}
          </span>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {!identitiesHidden && !votedFor && a?.slug && b?.slug && (
              <button
                type="button"
                onClick={handleChallenge}
                title="Comparte este duelo para retar a un amigo a votarlo"
                className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-0 py-2 text-[12px] font-semibold text-gold transition-all hover:border-accent hover:bg-accent/15 sm:w-auto sm:px-3.5"
              >
                <Swords className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Reta a un amigo</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setFastMode((f) => !f)}
              aria-pressed={fastMode}
              title={fastMode ? 'Auto-siguiente activo · clic para desactivar' : 'Auto-siguiente desactivado · clic para activar'}
              className={`inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-0 py-2 text-[12px] font-semibold transition-all sm:w-auto sm:px-3.5 ${
                fastMode
                  ? 'border-medal-gold/60 bg-medal-gold/10 text-medal-gold'
                  : 'border-border bg-surface text-fg-muted hover:border-medal-gold/40 hover:text-medal-gold'
              }`}
            >
              <Zap className={`h-3.5 w-3.5 ${fastMode ? 'fill-medal-gold' : ''}`} />
              <span className="sr-only sm:not-sr-only">Modo rápido</span>
            </button>
            <button
              type="button"
              onClick={() => setBlindMode((value) => !value)}
              aria-pressed={blindMode}
              title={blindMode ? 'Voto a ciegas activo · clic para desactivar' : 'Voto a ciegas desactivado · clic para activar'}
              className={`inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-0 py-2 text-[12px] font-semibold transition-all sm:w-auto sm:px-3.5 ${
                blindMode
                  ? 'border-accent/60 bg-accent-soft text-gold'
                  : 'border-border bg-surface text-fg-muted hover:border-accent/40 hover:text-gold'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Voto a ciegas</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={controlsDisabled}
              className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-0 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-gold disabled:opacity-50 sm:w-auto sm:px-3.5"
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">
                {votedFor ? 'Siguiente duelo' : 'Saltar duelo'}
              </span>
              <ArrowRight className="hidden h-3 w-3 sm:block" />
            </button>
          </div>
        </div>

        {/* Pregunta principal */}
        <header className="flex flex-col items-center gap-0.5 text-center sm:gap-1">
          <h1 className="text-2xl font-extrabold leading-tight tracking-normal sm:text-3xl">
            ¿A quién prefieres?
          </h1>
          <p className="max-w-xl text-[12px] text-fg-muted sm:text-[13px]">
            {arenaDescription}
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

        {/* Arena — subcomponente memoizado con AnimatePresence para aislar re-renders */}
        <VoteArena
          a={a}
          b={b}
          votedFor={votedFor}
          voteResult={voteResult}
          controlsDisabled={controlsDisabled}
          votoInvitadoActivo={votoInvitadoActivo}
          blindMode={identitiesHidden}
          handleVoteLeft={handleVoteLeft}
          handleVoteRight={handleVoteRight}
          handleTieVote={handleTieVote}
          canTie={modoBackend}
          ownsEspecialA={Boolean(a?.slug && misEspeciales?.has(a.slug))}
          ownsEspecialB={Boolean(b?.slug && misEspeciales?.has(b.slug))}
        />

        {tieSelected && a && b && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-gold/30 bg-gold-soft px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="min-w-0 flex-1"
            >
              <p className="text-sm font-black text-fg-strong">
                No pudiste decidir entre {a.nombre} y {b.nombre}.
              </p>
              <p className="text-[12px] text-fg-muted">
                {voteResult?.votosGanador != null && voteResult?.votosPerdedor != null
                  ? `Medio voto para cada lado · ${formatVoteScore(voteResult.votosGanador)} vs ${formatVoteScore(voteResult.votosPerdedor)}`
                  : 'Empate neutral registrado. No mueve el ELO del duelo.'}
              </p>
              {voteResult?.votosGanador != null && voteResult?.votosPerdedor != null && (
                <HeadToHeadBar
                  ganadorNombre={a.nombre}
                  perdedorNombre={b.nombre}
                  votosGanador={voteResult.votosGanador}
                  votosPerdedor={voteResult.votosPerdedor}
                />
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-bg/60 px-3 py-2 text-[12px] font-black text-gold">
              <Scale className="h-3.5 w-3.5" />
              ½ + ½
            </span>
          </div>
        )}

        {votedPersonaje && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="min-w-0 flex-1"
            >
              <p className="text-sm font-black text-fg-strong">
                {votedPersonaje.nombre} ganó tu duelo.
              </p>
              <p className="text-[12px] text-fg-muted">
                {voteResult?.votosGanador != null
                  ? `${formatVoteScore(voteResult.votosGanador)} votos para ${votedPersonaje.nombre}${losingPersonaje ? ` · rival: ${losingPersonaje.nombre}` : ''}`
                  : 'Voto registrado en modo casual. Sigue para completar tu misión diaria.'}
              </p>
              {/* Barra split cabeza-a-cabeza — solo cuando el backend devuelve ambos totales */}
              {voteResult?.votosGanador != null && voteResult?.votosPerdedor != null && losingPersonaje && (
                <HeadToHeadBar
                  ganadorNombre={votedPersonaje.nombre}
                  perdedorNombre={losingPersonaje.nombre}
                  votosGanador={voteResult.votosGanador}
                  votosPerdedor={voteResult.votosPerdedor}
                />
              )}
              {personalVoteImpact?.slug === votedPersonaje.slug && (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-2.5 py-1 text-[11px] font-black text-gold">
                  {formatPersonalVoteImpact(personalVoteImpact)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={handleShareVote}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-4 py-2 text-[13px] font-black text-white transition-colors hover:bg-accent-hover"
              >
                <Swords className="h-3.5 w-3.5" />
                Reta a un amigo
              </button>
              <Link
                to="/mi-ranking"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
              >
                Mi ranking
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Retirado el selector de intención post-voto (decisión del owner
            2026-06-09): con el auto-next de ~900ms no daba tiempo a usarlo y
            interrumpía el ritmo de votación. El backend de intenciones sigue
            vivo para los rankings por categoría; si se recupera, debe ser en
            un punto sin fricción (p.ej. perfil o ficha del personaje). */}

        {sessionStats.total > 0 && sessionStats.total % 10 === 0 && (
          <SessionRecap stats={sessionStats} onShare={handleShareSessionRecap} />
        )}

        {/* Modos rápidos + misión diaria — en móvil colapsados para que
            la arena y el panel de resultado quepan sin scroll */}
        <div className="hidden sm:contents">
          <VotarQuickModes
            a={a}
            b={b}
            fixedAnime={fixedAnime}
            fixedPersonaje={fixedPersonaje}
            hasFixedDuel={exactDuelActive}
            hasFixedAnime={hasFixedAnime}
            blindMode={identitiesHidden}
          />
          <DailyMissionPanel compact />
        </div>
        <MobileExtrasToggle
          a={a}
          b={b}
          fixedAnime={fixedAnime}
          fixedPersonaje={fixedPersonaje}
          exactDuelActive={exactDuelActive}
          hasFixedAnime={hasFixedAnime}
          blindMode={identitiesHidden}
        />

        {/* Atajos + (en sin matches) link a torneos */}
        <div className="flex flex-col items-center gap-2">
          <p className="hidden text-[11px] text-fg-muted sm:block">
            Atajos:{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              ←
            </kbd>{' '}
            izquierda ·{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              →
            </kbd>{' '}
            derecha ·{' '}
            <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
              S
            </kbd>{' '}
            saltar
            {votedFor && (
              <>
                {' '}·{' '}
                <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-surface px-1 font-mono text-[10px] text-fg-strong">
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
        {/* Captcha Turnstile bajo abuso. El modal se monta solo cuando el
            backend devuelve 428 con sitekey. Lazy + Suspense para no cargar
            el script en bundle inicial. */}
        {captchaChallenge && (
          <Suspense fallback={null}>
            <CaptchaModal
              open={Boolean(captchaChallenge)}
              sitekey={captchaChallenge.sitekey}
              onSuccess={(token) => {
                const ch = captchaChallenge
                setCaptchaChallenge(null)
                if (!ch) return
                voteLockedRef.current = true
                setVotedFor(ch.empate ? TIE_VOTE_KEY : ch.personajeSlug)
                // Re-emitimos el voto con el token. El backend valida
                // contra Cloudflare y, si OK, registra el voto.
                votarMutation.mutate(
                  {
                    enfrentamientoId: ch.enfrentamientoId,
                    personajeGanadorId: ch.personajeId,
                    anonymous: ch.anonymous,
                    captchaToken: token,
                    empate: ch.empate,
                  },
                  {
                    onSuccess: (data) => {
                      if (ch.empate) {
                        handleTieVoteSuccess(data)
                        return
                      }
                      handleVoteSuccess(
                        ch.personaje || { slug: ch.personajeSlug, nombre: ch.personajeNombre },
                        data,
                        ch.perdedor,
                      )
                    },
                    onError: (err) => {
                      voteLockedRef.current = false
                      setVotedFor(null)
                      toast.error('No se pudo validar el captcha', {
                        description: err?.message || 'Inténtalo de nuevo.',
                      })
                    },
                  },
                )
              }}
              onClose={() => {
                voteLockedRef.current = false
                setCaptchaChallenge(null)
                setVotedFor(null)
              }}
            />
          </Suspense>
        )}
    </VisualPageShell>
  )
}

export default VotarPage
