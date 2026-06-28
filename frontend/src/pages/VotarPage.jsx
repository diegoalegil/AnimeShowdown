import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { endpoints, ApiError } from '../lib/api'
import {
  ANON_VOTE_LIMIT,
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
import AnonVoteLimitModal from '../features/votar/components/AnonVoteLimitModal'
import MobileExtrasToggle from '../features/votar/components/MobileExtrasToggle'
import SessionRecap from '../features/votar/components/SessionRecap'
import TieResultPanel from '../features/votar/components/TieResultPanel'
import VotarShortcutsFooter from '../features/votar/components/VotarShortcutsFooter'
import VotarTopBar from '../features/votar/components/VotarTopBar'
import VoteArena from '../features/votar/components/VoteArena'
import FightBill from '../features/votar/components/FightBill'
import VoteResultPanel from '../features/votar/components/VoteResultPanel'
import PressSheet from '../components/PressSheet'
import SessionStreakCounter from '../features/votar/components/SessionStreakCounter'
import { useMisEspeciales } from '../hooks/useCartas'
import VotarQuickModes from '../features/votar/components/VotarQuickModes'
import { useFixedDuelParams } from '../features/votar/hooks/useFixedDuelParams'
import { useVotarPreferences } from '../features/votar/hooks/useVotarPreferences'
import { useVotarShare } from '../features/votar/hooks/useVotarShare'
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
import { VOTO_REGISTRADO_EVENT, emitAppEvent } from '../lib/app-events'
import { track, FUNNEL_EVENTS } from '../lib/analytics'
import { warmPersonajeImage } from '../lib/personaje-img-srcset'
import { imagenPersonaje } from '../lib/personajes-core'
import { toFighter } from '../features/versus/versus-fighter'

// La intro cinemática va LAZY: saca VersusIntro (framer-motion) del chunk
// crítico de /votar → no carga TBT al primer paint (es un flourish de sesión
// que entra un instante después).
const VersusIntroOverlay = lazy(() => import('../features/versus/VersusIntroOverlay'))

// Suscripción imperativa del contador de racha al evento de voto de la casa
// (identidad estable a nivel de módulo: el contador se monta UNA vez y
// escucha — cero estado React por voto).
const subscribeVotosSesion = (listener) => {
  const handler = () => listener()
  window.addEventListener(VOTO_REGISTRADO_EVENT, handler)
  return () => window.removeEventListener(VOTO_REGISTRADO_EVENT, handler)
}

// Claves y tiempo de vida para el prefetch del siguiente par.
// gcTime de 8s: suficiente para que el usuario vea el resultado y avance.
const BACKEND_QUERY_KEY = ['enfrentamientos', 'siguiente']
const PREFETCH_BACKEND_KEY = ['enfrentamientos', 'prefetch-siguiente']
const PREFETCH_SUGERIDO_KEY = ['votar', 'duelo-sugerido-prefetch']
const PREFETCH_GC_TIME = 8_000

// Espeja el sizes del <picture> de VoteCard: el warm pide la MISMA
// candidata que pintará la carta y la descarga aterriza en caché HTTP
// antes del swap (sin esto, la cara "pop-ea" en mitad de la ceremonia).
const VOTE_CARD_SIZES = '(max-width: 640px) 42vw, (max-width: 1024px) 38vw, 320px'
function warmParImagenes(par) {
  ;[par?.personaje1, par?.personaje2].forEach((p) => {
    if (!p) return
    warmPersonajeImage(p.imagenUrl ?? p.imagen ?? imagenPersonaje(p.slug), VOTE_CARD_SIZES)
  })
}

// Breakpoints del cartel de la velada (patrón matchMedia+useSyncExternalStore
// de VoteResultPanel): UNA instancia real por viewport — nada de montar dos
// copias bajo display:none corriendo timers en móvil.
const CARTEL_SM_QUERY = '(min-width: 640px)'
const CARTEL_RAIL_QUERY = '(min-width: 1568px)'
const subscribeCartelSm = (cb) => {
  const mq = window.matchMedia(CARTEL_SM_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const subscribeCartelRail = (cb) => {
  const mq = window.matchMedia(CARTEL_RAIL_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const readCartelSm = () => window.matchMedia(CARTEL_SM_QUERY).matches
const readCartelRail = () => window.matchMedia(CARTEL_RAIL_QUERY).matches

/**
 * El cartel de la velada, autocontenido: observa la cache del prefetch
 * (enabled:false — jamás fetchea por su cuenta; el cartel enseña EXACTAMENTE
 * lo que el auto-avance va a usar) y decide su placement por viewport:
 * nada <sm (el duelo manda), tira inferior con los extras en sm..2xl y rail
 * absoluto en el gutter derecho a partir de 1568px (a 2xl exacto el gutter
 * mide 256px y un rail de ml-8+w-60 salía recortado por el overflow del
 * shell). El re-render del ciclo del prefetch muere aquí dentro, no en la
 * página.
 */
function FightBillRail({ modoBackend, a, b, matchId, fetchSiguienteBackend }) {
  const isSm = useSyncExternalStore(subscribeCartelSm, readCartelSm)
  const isRail = useSyncExternalStore(subscribeCartelRail, readCartelRail)
  const { data: siguienteEnCartel, isFetching: reponiendoCartel } = useQuery({
    queryKey: PREFETCH_BACKEND_KEY,
    queryFn: fetchSiguienteBackend,
    enabled: false,
    gcTime: PREFETCH_GC_TIME,
  })
  const cartelActual = useMemo(
    () => (modoBackend && a && b && matchId != null ? { key: String(matchId), a, b } : null),
    [a, b, matchId, modoBackend],
  )
  const cartelCola = useMemo(() => {
    if (!modoBackend) return []
    const p1 = siguienteEnCartel?.personaje1
    const p2 = siguienteEnCartel?.personaje2
    const id = Number(siguienteEnCartel?.id)
    if (!p1 || !p2 || !Number.isInteger(id)) return []
    // El prefetch recién consumido puede seguir en cache apuntando al duelo
    // en curso: no es "el siguiente", no se enseña.
    if (String(id) === String(matchId)) return []
    return [{ key: String(id), a: p1, b: p2 }]
  }, [matchId, modoBackend, siguienteEnCartel])

  if (!isSm || !cartelActual) return null
  if (isRail) {
    return (
      <div className="absolute left-full top-24 ml-4 w-56">
        <FightBill
          current={cartelActual}
          queue={cartelCola}
          replenishing={reponiendoCartel}
          maxSlots={1}
        />
      </div>
    )
  }
  return (
    <FightBill
      current={cartelActual}
      queue={cartelCola}
      placement="bottom"
      replenishing={reponiendoCartel}
      maxSlots={1}
    />
  )
}

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
 *   - VS de tinta central (DuelEntrance): la línea carmesí/oro nace por
 *     corte vertical; el slam del voto vive en VsBadge montado en su glifo.
 *   - "Saltar" arriba a la derecha, siempre visible.
 *   - Nombre + anime bajo cada carta los pinta DuelEntrance con corte de
 *     tinta (VoteCard va con captionHidden) → comparación rápida.
 *   - Atajos de teclado: ← vota izquierda, → derecha, S saltar, Espacio
 *     siguiente cuando ya hay voto.
 *   - Modo rápido (toggle): tras votar carga el siguiente duelo automáticamente.
 *
 * Mantiene el modo híbrido del backend (match real si hay torneo, casual
 * con pares random local si no).
 */

const TIE_VOTE_KEY = '__empate__'
// Pausa breve entre voto y siguiente duelo. En una pantalla de juego, 1.8s
// se percibía como bloqueo; ~0.9s conserva feedback y mantiene ritmo.
const NEXT_DELAY_MS = 900

function hasPrefetchReadyOrRunning(queryClient, queryKey) {
  const state = queryClient.getQueryState(queryKey)
  return state?.fetchStatus === 'fetching' || queryClient.getQueryData(queryKey) != null
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
  const queryClient = useQueryClient()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const {
    fixedSlug,
    fixedAnime,
    fixedPersonaje,
    fixedRival,
    hasFixedDuel,
    hasFixedAnime,
    casualContextKey,
  } = useFixedDuelParams(catalogoPersonajes)
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
  const { fastMode, setFastMode, fastModeRef, blindMode, setBlindMode } = useVotarPreferences()

  // Resultado del último voto registrado: el backend devuelve delta + votos
  // post-voto. Sirve para pintar el overlay "+1 ELO" sobre la card ganadora.
  // Se resetea cuando llega un nuevo enfrentamiento o tras saltar.
  const [voteResult, setVoteResult] = useState(null)
  const [showAnonLimitModal, setShowAnonLimitModal] = useState(false)
  useEffect(() => {
    // Embudo: el invitado chocó con el muro de 5 votos (fricción de activación
    // clave). Se cuenta al abrir el muro, una vez por transición a visible.
    if (showAnonLimitModal) track(FUNNEL_EVENTS.VOTE_WALL_HIT)
  }, [showAnonLimitModal])
  // Cuando el backend devuelve 428, guardamos el voto pendiente (sitekey,
  // ids del enfrentamiento y personaje) y abrimos el captcha modal. Tras
  // éxito, re-emitimos la mutation con el header X-AS-Captcha-Token.
  const [captchaChallenge, setCaptchaChallenge] = useState(null)

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
  // mutate ES referencialmente estable en TanStack v5; el objeto votarMutation
  // NO (uno nuevo por render) — tenerlo en deps recreaba handleVote y
  // handleTieVote en cada ciclo y rompía el memo de VoteArena/VoteCard.
  const { mutate: votar } = votarMutation
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
  // Intro cinemática de sesión: el overlay decide por sessionStorage (storageKey
  // fija) que se vea UNA sola vez por sesión, en el primer duelo. Saltable.
  const introFighters = useMemo(
    () => (a && b ? { left: toFighter(a), right: toFighter(b) } : null),
    [a, b],
  )
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
      queryClient
        .prefetchQuery({
          queryKey: PREFETCH_BACKEND_KEY,
          queryFn: fetchSiguienteBackend,
          staleTime: 0,
          gcTime: PREFETCH_GC_TIME,
        })
        .then(() => warmParImagenes(queryClient.getQueryData(PREFETCH_BACKEND_KEY)))
    } else if (modoSugerido) {
      if (hasPrefetchReadyOrRunning(queryClient, PREFETCH_SUGERIDO_KEY)) return
      queryClient
        .prefetchQuery({
          queryKey: PREFETCH_SUGERIDO_KEY,
          queryFn: endpoints.dueloSugerido,
          staleTime: 0,
          gcTime: PREFETCH_GC_TIME,
        })
        .then(() => warmParImagenes(queryClient.getQueryData(PREFETCH_SUGERIDO_KEY)))
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
  const coinsTimeoutRef = useRef(null)
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
      if (coinsTimeoutRef.current) clearTimeout(coinsTimeoutRef.current)
      coinsTimeoutRef.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['monedero'] })
      }, 1500)
    },
    [queryClient],
  )

  // Limpia el timeout de reconciliación del saldo al desmontar (se re-arma
  // limpio en cada voto, arriba): sin esto quedaba colgado.
  useEffect(() => () => {
    if (coinsTimeoutRef.current) clearTimeout(coinsTimeoutRef.current)
  }, [])

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
      // Señal plana para oyentes desacoplados (onboarding): voto confirmado.
      emitAppEvent(VOTO_REGISTRADO_EVENT, { slug: personaje.slug })

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
              : `Ahora suma ${formatVoteScore(data.votosGanador)} votos en este duelo${impact ? ` · #${impact.rank} en tu ranking` : ''}`
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
    [scheduleAutoNext, trackLocalVote, prefetchSiguientePar, notifyCoins, fastModeRef],
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
      // El empate también es un voto de la sesión (racha + oyentes).
      emitAppEvent(VOTO_REGISTRADO_EVENT, { empate: true })
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
    [a, b, prefetchSiguientePar, scheduleAutoNext, notifyCoins, fastModeRef],
  )

  const {
    handleChallenge,
    handleShareVote,
    handleShareSessionRecap,
    handleShareResultImage,
    dueloShareOpen,
    closeDueloShare,
    pintarDueloBlob,
    dueloContexto,
    onDueloShared,
  } = useVotarShare({
    a,
    b,
    votedPersonaje,
    losingPersonaje,
    voteResult,
    personalVoteImpact,
    sessionStats,
    fixedSlug,
    fixedAnime,
  })

  // Cierra la hoja de compartir del duelo al AVANZAR: al pasar de duelo,
  // votedPersonaje se limpia (handleNext) → dueloContexto pasa a null y el
  // PressSheet se desmonta SIN llamar onClose, dejando dueloShareOpen pegajoso;
  // sin este reset, el modal se autoabriría solo en el siguiente duelo (modo
  // rápido). Resetear cuando no hay contexto cubre los 3 avances (click/Esc/auto).
  useEffect(() => {
    if (!dueloContexto) closeDueloShare()
  }, [dueloContexto, closeDueloShare])

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
        votar(
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
      votar,
      matchId,
      scheduleAutoNext,
      handleVoteSuccess,
      prefetchSiguientePar,
      votedFor,
      a,
      b,
      trackLocalVote,
      fastModeRef,
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
    votar(
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
  }, [modoBackend, matchId, votedFor, user, votar, handleTieVoteSuccess])

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

  // Estado terminal: el backend cayó (5xx/red, no el 404 sano), no hay
  // catálogo local (primera visita) y el duelo sugerido tampoco respondió.
  // Sin esto la página quedaba en "Preparando duelo…" PARA SIEMPRE (retry
  // false en ambas queries y refetchOnWindowFocus global apagado).
  const sinDuelo =
    isError &&
    !sinMatchesAbiertos &&
    !canUseLocalCatalog &&
    !modoSugerido &&
    !isFetchingDueloSugerido
  if (sinDuelo) {
    return (
      <VisualPageShell
        visual={{ ...BRAND_VISUALS.torneos, kanji: '闘' }}
        className="flex min-h-[calc(100vh-6rem)] items-center justify-center"
        contentClassName="flex flex-col items-center gap-4 text-center"
        lateralKanji={null}
      >
        <span className="font-kanji-serif text-6xl text-gold opacity-40" lang="ja" aria-hidden="true">
          闘
        </span>
        <div>
          <p className="text-lg font-bold text-fg-strong">La arena no responde</p>
          <p className="mt-1 max-w-sm text-[13px] text-fg-muted">
            No pudimos traer ningún duelo. Suele ser cosa de la conexión —
            reintenta en unos segundos.
          </p>
        </div>
        <button
          type="button"
          disabled={isFetching || isFetchingDueloSugerido}
          onClick={() => {
            refetch()
            refetchDueloSugerido()
          }}
          className="as-button-primary rounded-lg px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching || isFetchingDueloSugerido ? 'Reintentando…' : 'Reintentar'}
        </button>
      </VisualPageShell>
    )
  }

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
      contentClassName="relative mx-auto flex max-w-5xl flex-col gap-3 sm:gap-4"
      lateralKanji={{ left: '挑', right: '闘' }}
      className="min-h-[calc(100svh-5rem)] py-3 sm:py-8 lg:py-10"
      atmosphere="arena-storm"
    >
        <VotarTopBar
          arenaStatusLabel={arenaStatusLabel}
          live={modoBackend}
          showChallenge={Boolean(!identitiesHidden && !votedFor && a?.slug && b?.slug)}
          onChallenge={handleChallenge}
          fastMode={fastMode}
          onToggleFastMode={() => setFastMode((f) => !f)}
          blindMode={blindMode}
          onToggleBlindMode={() => setBlindMode((value) => !value)}
          onNext={handleNext}
          controlsDisabled={controlsDisabled}
          votedFor={votedFor}
        />

        {/* Pregunta principal */}
        <header className="flex flex-col items-center gap-0.5 text-center sm:gap-1">
          <h1 className="font-display text-2xl leading-tight sm:text-3xl">
            ¿A quién prefieres?
          </h1>
          <p className="max-w-xl text-[12px] text-fg-muted sm:text-[13px]">
            {arenaDescription}
          </p>
        </header>

        {votoInvitadoActivo && (
          <div className="rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-center text-[13px] font-medium text-gold">
            Modo invitado: tus primeros {ANON_VOTE_LIMIT} votos cuentan, pero
            valen menos que los de una cuenta.
            <Link to="/login?next=%2Fvotar" className="ml-1 underline decoration-gold/50 underline-offset-4 hover:text-fg-strong">
              Entra para voto completo e historial.
            </Link>
          </div>
        )}

        {/* Arena — subcomponente memoizado con AnimatePresence para aislar re-renders.
            La insignia de racha vive FUERA del memo y del key del par: ni
            re-renderiza la arena al subir el contador ni re-popea al cambiar
            de duelo. */}
        {/* En modo a ciegas la intro NO se muestra: revela nombre/imagen/kanji y
            spoilearía la identidad antes del voto. Mismo gate que FightBillRail. */}
        {!blindMode && introFighters && (
          <Suspense fallback={null}>
            <VersusIntroOverlay
              left={introFighters.left}
              right={introFighters.right}
              storageKey="vs-intro:votar-sesion"
            />
          </Suspense>
        )}
        <div className="relative">
          <VoteArena
            a={a}
            b={b}
            votedFor={votedFor}
            voteResult={voteResult}
            controlsDisabled={controlsDisabled}
            votoInvitadoActivo={votoInvitadoActivo}
            blindMode={identitiesHidden}
            blindReveal={blindMode && Boolean(votedFor)}
            handleVoteLeft={handleVoteLeft}
            handleVoteRight={handleVoteRight}
            handleTieVote={handleTieVote}
            canTie={modoBackend}
            fastMode={fastMode}
            ownsEspecialA={Boolean(a?.slug && misEspeciales?.has(a.slug))}
            ownsEspecialB={Boolean(b?.slug && misEspeciales?.has(b.slug))}
          />
          {/* Contador 連 de la racha de sesión: overlay de la esquina, montado
              UNA vez fuera del key del par — escucha el evento de voto por
              suscripción imperativa y jamás re-renderiza la arena. El inset
              extra deja sitio al ensō (sobresale ~0.7em del numeral). */}
          <SessionStreakCounter
            subscribe={subscribeVotosSesion}
            onMilestone={() => play('playStreakHito')}
            className="pointer-events-none absolute -top-2 right-1 z-30 sm:right-2"
          />
        </div>

        {tieSelected && a && b && (
          <TieResultPanel a={a} b={b} voteResult={voteResult} />
        )}

        {votedPersonaje && (
          <VoteResultPanel
            votedPersonaje={votedPersonaje}
            losingPersonaje={losingPersonaje}
            voteResult={voteResult}
            personalVoteImpact={personalVoteImpact}
            onShareVote={handleShareVote}
            onShareResultImage={handleShareResultImage}
          />
        )}

        {dueloContexto && (
          <PressSheet
            open={dueloShareOpen}
            onClose={closeDueloShare}
            painter={pintarDueloBlob}
            contexto={dueloContexto}
            onShared={onDueloShared}
          />
        )}

        {/* Retirado el selector de intención post-voto (decisión del owner
            2026-06-09): con el auto-next de ~900ms no daba tiempo a usarlo y
            interrumpía el ritmo de votación. El backend de intenciones sigue
            vivo para los rankings por categoría; si se recupera, debe ser en
            un punto sin fricción (p.ej. perfil o ficha del personaje). */}

        {/* Recap con CTAs de compartir / Top 5 cada 10 votos. Para invitados,
            que topan a ANON_VOTE_LIMIT votos, también lo mostramos al llegar al
            techo: así el muro de 5 votos se convierte en un momento viral /
            de creación de Top 5, no solo en una petición de cuenta. */}
        {sessionStats.total > 0 &&
          (sessionStats.total % 10 === 0 ||
            (!user && sessionStats.total === ANON_VOTE_LIMIT)) && (
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
        {/* El cartel de la velada: UNA sola instancia real (FightBillRail
            decide por matchMedia: nada <sm, tira inferior sm..2xl, rail
            absoluto en el gutter ≥2xl) y desaparece en modo a ciegas — el
            cartel enseñaría las identidades del duelo y del siguiente. */}
        {!blindMode && (
          <FightBillRail
            modoBackend={modoBackend}
            a={a}
            b={b}
            matchId={matchId}
            fetchSiguienteBackend={fetchSiguienteBackend}
          />
        )}
        <MobileExtrasToggle
          a={a}
          b={b}
          fixedAnime={fixedAnime}
          fixedPersonaje={fixedPersonaje}
          exactDuelActive={exactDuelActive}
          hasFixedAnime={hasFixedAnime}
          blindMode={identitiesHidden}
        />

        <VotarShortcutsFooter votedFor={votedFor} sinMatchesAbiertos={sinMatchesAbiertos} />
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
                votar(
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
