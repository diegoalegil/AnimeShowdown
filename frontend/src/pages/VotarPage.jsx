import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Share2, SkipForward, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { getPopularidad } from '../lib/personajes-core'
import { endpoints, ApiError } from '../lib/api'
import {
  getAnonymousVoteHeaders,
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
import AnonVoteLimitModal from '../features/votar/components/AnonVoteLimitModal'
import SessionRecap from '../features/votar/components/SessionRecap'
import VoteCard from '../features/votar/components/VoteCard'
import VotarQuickModes from '../features/votar/components/VotarQuickModes'
import VsBadge from '../features/votar/components/VsBadge'
import { useVoteKeyboardShortcuts } from '../features/votar/hooks/useVoteKeyboardShortcuts'
import { useVoteSessionStats } from '../features/votar/hooks/useVoteSessionStats'

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
const STORAGE_VOTES_COUNT = 'animeshowdown.votos_count'
const VOTES_COUNT_EVENT = 'animeshowdown:votes-count'
const ANON_VOTE_LIMIT = 5
// Pausa breve entre voto y siguiente duelo. En una pantalla de juego, 1.8s
// se percibía como bloqueo; ~0.9s conserva feedback y mantiene ritmo.
const NEXT_DELAY_MS = 900

/**
 * Emparejamientos balanceados + anti-repetición.
 *
 * Antes era 100% random sobre el catálogo — salían combinaciones
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
 * Añadimos buffer de últimos pares en sessionStorage para evitar el mismo
 * enfrentamiento (A vs B y B vs A son equivalentes) y penalizar a personajes
 * vistos recientemente. sessionStorage (no localStorage) porque
 * queremos que la memoria se limpie al cerrar la pestaña.
 */
const RECENT_PAIRS_KEY = 'animeshowdown.votar.recent-pairs'
const RECENT_CHARS_KEY = 'animeshowdown.votar.recent-chars'
const RECENT_PAIRS_MAX = 48
const RECENT_CHARS_MAX = 10

function pairKey(slugA, slugB) {
  // A↔B equivalentes: ordenamos alfabéticamente el slug menor primero.
  return slugA < slugB ? `${slugA}|${slugB}` : `${slugB}|${slugA}`
}

function readSessionList(key) {
  try {
    if (typeof sessionStorage === 'undefined') return []
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
    if (typeof sessionStorage === 'undefined') return
    const trimmed = list.slice(-max)
    sessionStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // sessionStorage puede fallar en private mode; sin él, la anti-
    // repetición simplemente no funciona en esa sesión (acceptable).
  }
}

function recordRecentPair(slugA, slugB) {
  if (!slugA || !slugB) return
  const pairs = readSessionList(RECENT_PAIRS_KEY)
  pairs.push(pairKey(slugA, slugB))
  writeSessionList(RECENT_PAIRS_KEY, pairs, RECENT_PAIRS_MAX)
  const chars = readSessionList(RECENT_CHARS_KEY)
  chars.push(slugA, slugB)
  writeSessionList(RECENT_CHARS_KEY, chars, RECENT_CHARS_MAX * 2)
}

function selectRandomPair(catalogoPersonajes) {
  const personajes = Array.isArray(catalogoPersonajes) ? catalogoPersonajes : []
  if (personajes.length < 2) return [null, null]
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
    return pair
  }

  // Fallback final: random sin restricciones (catálogo demasiado pequeño
  // o restricciones imposibles de satisfacer).
  const idxA = Math.floor(Math.random() * personajes.length)
  let idxB = Math.floor(Math.random() * personajes.length)
  while (idxB === idxA) idxB = Math.floor(Math.random() * personajes.length)
  return [personajes[idxA], personajes[idxB]]
}

function getPairWithFixed(catalogoPersonajes, fixedPersonaje) {
  const personajes = Array.isArray(catalogoPersonajes) ? catalogoPersonajes : []
  if (!fixedPersonaje || personajes.length < 2) return [null, null]
  const recentChars = new Set(readSessionList(RECENT_CHARS_KEY))
  const popA = getPopularidad(fixedPersonaje.slug)

  const candidatos = personajes
    .filter((p) => p.slug !== fixedPersonaje.slug)
    .map((p) => ({
      personaje: p,
      score:
        Math.abs(getPopularidad(p.slug) - popA) +
        (recentChars.has(p.slug) ? 20 : 0),
    }))
    .sort((x, y) => x.score - y.score)
    .slice(0, 24)

  const rival = candidatos[Math.floor(Math.random() * candidatos.length)]?.personaje
  if (!rival) return selectRandomPair(personajes)
  return Math.random() > 0.5 ? [fixedPersonaje, rival] : [rival, fixedPersonaje]
}

function getPairFromAnime(catalogoPersonajes, anime) {
  const pool = (Array.isArray(catalogoPersonajes) ? catalogoPersonajes : [])
    .filter((p) => p.anime === anime)
  if (pool.length < 2) return selectRandomPair(catalogoPersonajes)
  return selectRandomPair(pool)
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

function formatPersonalVoteImpact(impact) {
  if (!impact) return ''
  const plural = impact.count === 1 ? '' : 's'
  return `#${impact.rank} en tu ranking personal · ${impact.count} voto${plural} tuyo${plural}`
}

function VotarPage() {
  useSeo({
    title: 'Votar',
    description:
      'Arena de duelos: elige al ganador de cada enfrentamiento entre personajes anime y mueve el ranking ELO de AnimeShowdown.',
  })
  const { play } = useSound()
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
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

  useEffect(() => {
    if (fastMode || autoNextTimeoutRef.current == null) return
    clearTimeout(autoNextTimeoutRef.current)
    autoNextTimeoutRef.current = null
  }, [fastMode])

  const votarMutation = useMutation({
    mutationFn: ({ enfrentamientoId, personajeGanadorId, anonymous, captchaToken }) => {
      // Si tenemos token Turnstile, viajará en el header
      // X-AS-Captcha-Token. El backend lo verifica antes de aplicar el
      // throttle de captcha.
      const headers = anonymous ? { ...getAnonymousVoteHeaders() } : {}
      if (captchaToken) headers['X-AS-Captcha-Token'] = captchaToken
      return endpoints.votar(enfrentamientoId, personajeGanadorId, {
        anonymous,
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torneos'] })
    },
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
    recordedPairKeyRef.current = currentPairKey
  }, [a?.slug, b?.slug, currentPairKey])

  const votedPersonaje = votedFor === a?.slug ? a : votedFor === b?.slug ? b : null
  const losingPersonaje = votedFor === a?.slug ? b : votedFor === b?.slug ? a : null
  const {
    sessionStats,
    personalVoteImpact,
    setPersonalVoteImpact,
    trackLocalVote,
  } = useVoteSessionStats()

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
        const result = await refetch()
        const nextKey =
          result?.data?.personaje1?.slug && result?.data?.personaje2?.slug
            ? pairKey(result.data.personaje1.slug, result.data.personaje2.slug)
            : ''
        if (nextKey && nextKey === previousKey) {
          await refetch()
        }
      } else if (modoSugerido) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const result = await refetchDueloSugerido()
          const nextKey =
            result?.data?.personaje1?.slug && result?.data?.personaje2?.slug
              ? pairKey(result.data.personaje1.slug, result.data.personaje2.slug)
              : ''
          if (nextKey && nextKey !== previousKey) break
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

      const delta = data?.delta ?? 1
      const sufijo = delta === 1 ? 'voto' : 'votos'
      toast.success(`+${delta} ${sufijo} · ${personaje.nombre}`, {
        description: data?.votosGanador != null
          ? data?.anonimo
            ? `Voto invitado guardado · te quedan ${data.votosAnonimosRestantes ?? 0}${impact ? ` · #${impact.rank} en tu ranking` : ''}`
            : `Ahora suma ${data.votosGanador} votos en este match${impact ? ` · #${impact.rank} en tu ranking` : ''}`
          : impact
            ? formatPersonalVoteImpact(impact)
            : 'Voto registrado · ranking actualizado',
      })

      scheduleAutoNext()
    },
    [scheduleAutoNext, trackLocalVote],
  )

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
      toast.success(result === 'native' ? 'Duelo compartido' : 'Duelo copiado')
    } catch (error) {
      toast.error('No se pudo compartir', {
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
      // Solo playVote: antes había también playImpact (sub-bass thump)
      // pero los dos juntos disparaban 9 nodos Web Audio en el mismo
      // tick del click handler y se percibía un lag perceptible entre
      // el click y el primer sample. playVote ya tiene 4 notas + sparkle,
      // suficiente para feedback contundente.
      play('playVote')

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
        toast.success(`+${personaje.nombre}`, {
          description: impact
            ? formatPersonalVoteImpact(impact)
            : 'Modo casual · sin torneo activo',
        })
        scheduleAutoNext()
      }
    },
    [
      play,
      modoBackend,
      user,
      navigate,
      votarMutation,
      matchId,
      scheduleAutoNext,
      handleVoteSuccess,
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
  const handleVoteLeft = useCallback(() => {
    if (a) handleVote(a)
  }, [a, handleVote])
  const handleVoteRight = useCallback(() => {
    if (b) handleVote(b)
  }, [b, handleVote])

  if ((!fixedPersonaje && !hasFixedAnime && isLoading) || needsCasualPair) {
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
      className="min-h-[calc(100svh-5rem)] py-4 sm:py-8 lg:py-10"
      atmosphere="arena-storm"
    >
        {/* Top bar: badge + modo rápido + skip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {modoBackend
              ? 'Match en juego · En vivo'
              : exactDuelActive
                ? `${fixedPersonaje.nombre} vs ${fixedRival.nombre}`
                : fixedPersonaje
                ? `Retando a ${fixedPersonaje.nombre}`
                : hasFixedAnime
                  ? `Duelo interno · ${fixedAnime}`
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
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[12px] font-semibold transition-all ${
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
              disabled={controlsDisabled}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-gold disabled:opacity-50"
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
                : exactDuelActive
                  ? `Duelo fijado desde una comparación: ${fixedPersonaje.nombre} vs ${fixedRival.nombre}`
                : fixedPersonaje
                  ? `Duelo fijado desde la ficha de ${fixedPersonaje.nombre}`
                  : hasFixedAnime
                    ? `Solo personajes de ${fixedAnime} en este duelo`
                  : 'Elige quién gana este duelo y ayuda a mover el ranking competitivo'}
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
          data-votar-arena
          key={`${a.slug}-${b.slug}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3 }}
          className="relative grid grid-cols-2 items-start gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-6"
        >
          <div className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2 sm:hidden">
            <VsBadge votedFor={votedFor} compact />
          </div>
          <VoteCard
            personaje={a}
            onClick={handleVoteLeft}
            disabled={controlsDisabled}
            isVoted={votedFor === a.slug}
            isLoser={votedFor && votedFor !== a.slug}
            showResult={Boolean(votedFor)}
            side="left"
            anonymousLimited={votoInvitadoActivo}
            voteResult={voteResult?.ganadorSlug === a.slug ? voteResult : null}
          />
          <div className="hidden self-center justify-self-center sm:flex">
            <VsBadge votedFor={votedFor} />
          </div>
          <VoteCard
            personaje={b}
            onClick={handleVoteRight}
            disabled={controlsDisabled}
            isVoted={votedFor === b.slug}
            isLoser={votedFor && votedFor !== b.slug}
            showResult={Boolean(votedFor)}
            side="right"
            anonymousLimited={votoInvitadoActivo}
            voteResult={voteResult?.ganadorSlug === b.slug ? voteResult : null}
          />
        </motion.div>

        {votedPersonaje && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-sm font-black text-fg-strong">
                {votedPersonaje.nombre} ganó tu duelo.
              </p>
              <p className="text-[12px] text-fg-muted">
                {voteResult?.votosGanador != null
                  ? `${voteResult.votosGanador} votos para ${votedPersonaje.nombre}${losingPersonaje ? ` · rival: ${losingPersonaje.nombre}` : ''}`
                  : 'Voto registrado en modo casual. Sigue para completar tu misión diaria.'}
              </p>
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
                <Share2 className="h-3.5 w-3.5" />
                Compartir duelo
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

        {sessionStats.total > 0 && sessionStats.total % 10 === 0 && (
          <SessionRecap stats={sessionStats} onShare={handleShareSessionRecap} />
        )}

        <VotarQuickModes
          a={a}
          b={b}
          fixedAnime={fixedAnime}
          fixedPersonaje={fixedPersonaje}
          hasFixedDuel={exactDuelActive}
          hasFixedAnime={hasFixedAnime}
        />

        <DailyMissionPanel compact />

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
                setVotedFor(ch.personajeSlug)
                // Re-emitimos el voto con el token. El backend valida
                // contra Cloudflare y, si OK, registra el voto.
                votarMutation.mutate(
                  {
                    enfrentamientoId: ch.enfrentamientoId,
                    personajeGanadorId: ch.personajeId,
                    anonymous: ch.anonymous,
                    captchaToken: token,
                  },
                  {
                    onSuccess: (data) => {
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
