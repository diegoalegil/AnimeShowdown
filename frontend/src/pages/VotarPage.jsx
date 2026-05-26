import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, LogIn, Share2, SkipForward, Swords, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { imagenPersonaje, getPopularidad } from '../lib/personajes-core'
import { endpoints, ApiError, api } from '../lib/api'
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
import VoteFeedbackBurst from '../components/VoteFeedbackBurst'
import AccessibleDialog from '../components/AccessibleDialog'
import PersonajeImg from '../components/PersonajeImg'
import DailyMissionPanel from '../components/DailyMissionPanel'
import { recordDailyShare, recordDailyVote } from '../lib/dailyProgress'
import { getLocalVoteStats, recordLocalVote } from '../lib/localVoteRanking'
import { shareOrCopy } from '../lib/share'

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
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    bySlug: {},
    closeDuels: 0,
    lastShareText: '',
  })
  const [personalVoteImpact, setPersonalVoteImpact] = useState(null)

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
            ? selectRandomPair(catalogoPersonajes)
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
    hasFixedDuel,
    hasFixedAnime,
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

  const trackLocalVote = useCallback((ganador, perdedor, data) => {
    recordDailyVote()
    const localVotes = recordLocalVote(ganador, perdedor)
    const localStats = getLocalVoteStats(localVotes)
    const rankIndex = localStats.top.findIndex((item) => item.slug === ganador.slug)
    const localRank = rankIndex >= 0 ? localStats.top[rankIndex] : null
    const impact = localRank
      ? {
          slug: ganador.slug,
          nombre: ganador.nombre,
          rank: rankIndex + 1,
          count: localRank.count,
          total: localStats.total,
        }
      : null
    setPersonalVoteImpact(impact)
    const votosGanador = Number(data?.votosGanador)
    const votosPerdedor = Number(data?.votosPerdedor)
    const isClose =
      Number.isFinite(votosGanador) &&
      Number.isFinite(votosPerdedor) &&
      Math.abs(votosGanador - votosPerdedor) <= 1
    setSessionStats((prev) => {
      const bySlug = { ...prev.bySlug }
      const current = bySlug[ganador.slug] || {
        nombre: ganador.nombre,
        anime: ganador.anime,
        count: 0,
      }
      bySlug[ganador.slug] = {
        ...current,
        count: current.count + 1,
      }
      const total = prev.total + 1
      const top = Object.values(bySlug)
        .sort((x, y) => y.count - x.count)
        .slice(0, 3)
        .map((p) => `${p.nombre} x${p.count}`)
        .join(', ')
      const lastShareText = [
        `Voté ${ganador.nombre} sobre ${perdedor?.nombre ?? 'su rival'} en AnimeShowdown.`,
        data?.votosGanador != null
          ? `${ganador.nombre} suma ${data.votosGanador} votos en este duelo.`
          : 'Mi voto acaba de mover el ranking casual.',
        top ? `Mi sesión: ${total} votos. Top: ${top}.` : `Mi sesión: ${total} votos.`,
      ].join('\n')
      return {
        total,
        bySlug,
        closeDuels: prev.closeDuels + (isClose ? 1 : 0),
        lastShareText,
      }
    })
    return impact
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
              voteLockedRef.current = false
              setVotedFor(null)
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
                  sitekey: err.body.sitekey || '',
                  anonymous: !user,
                })
                return
              }
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

  // Atajos de teclado: ← vota izquierda, → derecha, S saltar, Espacio
  // siguiente si ya votó. Solo activos cuando el usuario no está en un
  // input — el check `tagName` evita atrapar tecla cuando se escribe en
  // otro sitio de la UI (no debería haberlos en /votar pero defensivo).
  useEffect(() => {
    if (
      isLoading ||
      !a ||
      !b ||
      isFetching ||
      isFetchingDueloSugerido ||
      isVotePending ||
      isAdvancing ||
      showAnonLimitModal ||
      captchaChallenge
    ) {
      return
    }
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
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
  }, [
    isLoading,
    isFetching,
    isFetchingDueloSugerido,
    isVotePending,
    isAdvancing,
    showAnonLimitModal,
    captchaChallenge,
    a,
    b,
    handleVote,
    handleNext,
    votedFor,
  ])

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
                        { slug: ch.personajeSlug, nombre: ch.personajeNombre },
                        data,
                      )
                    },
                    onError: (err) => {
                      setVotedFor(null)
                      toast.error('No se pudo validar el captcha', {
                        description: err?.message || 'Inténtalo de nuevo.',
                      })
                    },
                  },
                )
              }}
              onClose={() => {
                setCaptchaChallenge(null)
                setVotedFor(null)
              }}
            />
          </Suspense>
        )}
    </VisualPageShell>
  )
}

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

const VsBadge = memo(function VsBadge({ votedFor, compact = false }) {
  const reduceMotion = useReducedMotion()
  // Sin animación infinita en idle: el badge central estaba recomponiendo
  // frames durante toda la sesión aunque el usuario no interactuara.
  return (
    <motion.div
      animate={
        votedFor
          ? reduceMotion
            ? { scale: 1.1 }
            : { scale: [1, 1.25, 1], rotate: [0, 8, -8, 0] }
          : { scale: 1 }
      }
      transition={{
        duration: votedFor ? 0.5 : 0,
        repeat: 0,
        ease: 'easeInOut',
      }}
      className={`relative flex items-center justify-center justify-self-center rounded-full border-2 border-accent bg-accent-soft text-gold shadow-[0_0_40px_-10px_rgba(255,46,99,0.7)] ${
        compact ? 'h-11 w-11' : 'h-14 w-14 sm:h-20 sm:w-20'
      }`}
    >
      <Swords className={compact ? 'h-[18px] w-[18px]' : 'h-5 w-5 sm:h-7 sm:w-7'} />
      <span className={`absolute font-mono font-extrabold uppercase tracking-[0.25em] text-gold ${
        compact ? '-bottom-5 text-[9px]' : '-bottom-6 text-[10px]'
      }`}>
        VS
      </span>
    </motion.div>
  )
})

function SessionRecap({ stats, onShare }) {
  const top = Object.values(stats.bySlug || {})
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <section className="rounded-xl border border-gold/35 bg-gold-soft p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gold">
            Recap de sesión
          </p>
          <h2 className="mt-1 text-xl font-black text-fg-strong">
            {stats.total} votos lanzados. El ranking ya notó tu mano.
          </h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            {stats.closeDuels > 0
              ? `${stats.closeDuels} duelos quedaron ajustados por 1 voto o menos.`
              : 'Sigue votando para encontrar duelos más polémicos.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/mi-ranking"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-bg/60 px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
          >
            Ver mi ranking
          </Link>
          <Link
            to="/mi-top5"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent-soft px-4 py-2 text-[13px] font-black text-fg-strong transition-colors hover:border-accent hover:text-gold"
          >
            Crear mi Top 5
          </Link>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold/45 bg-gold px-4 py-2 text-[13px] font-black text-bg transition-transform hover:scale-[1.01]"
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartir recap
          </button>
        </div>
      </div>
      {top.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {top.map((item) => (
            <span
              key={item.nombre}
              className="inline-flex rounded-full border border-border bg-bg/60 px-3 py-1 text-[12px] font-semibold text-fg-muted"
            >
              {item.nombre} · x{item.count}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

const VoteCard = memo(function VoteCard({
  personaje,
  onClick,
  disabled,
  isVoted,
  isLoser,
  showResult,
  side,
  anonymousLimited,
  voteResult,
}) {
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
        disabled={disabled || showResult}
        // perf: los keyframes scale[1,1.08,1] +
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
        // `all` reanimaba todo (filtros, fondos, padding...) en cada
        // hover/repaint, agitando el compositor en una página con dos
        // cards + dos letterboxes a la vez. Coste: del 30%-50% de un
        // frame en cards medianas según DevTools Performance.
        className={`group relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface transition-[transform,border-color,box-shadow,opacity,filter] ${
          isVoted
            ? 'border-accent shadow-[0_0_60px_-10px_rgba(255,46,99,0.7)] ring-2 ring-accent/40'
            : isLoser
              ? 'border-border opacity-40 grayscale'
              : 'border-border motion-safe:hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_0_40px_-15px_rgba(255,46,99,0.55)]'
        } disabled:cursor-default`}
      >
        <div
          className="relative aspect-[2/3] max-h-[min(44svh,28rem)] w-full overflow-hidden sm:max-h-[min(55svh,34rem)]"
          style={{ backgroundColor: dominantColor }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 36%, ${dominantColor} 0%, rgba(13, 13, 18, 0.72) 45%, rgba(13, 13, 18, 0.96) 100%)`,
            }}
          />
          <PersonajeImg
            slug={personaje.slug}
            src={imgSrc}
            alt={personaje.nombre}
            nombre={personaje.nombre}
            colorDominante={dominantColor}
            loading="eager"
            decoding="async"
            fetchPriority={side === 'left' ? 'high' : 'auto'}
            sizes="(max-width: 640px) 42vw, (max-width: 1024px) 38vw, 320px"
            className="relative h-full w-full object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
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
            animateValue={false}
            particles={false}
            // El backend cuenta votos del match, no un K-factor ELO real.
            // "Voto registrado" evita prometer una métrica distinta.
            label="Voto registrado"
          />
          {anonymousLimited && !showResult && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-gold/50 bg-black/70 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-gold backdrop-blur-sm">
              Voto invitado
            </div>
          )}
        </div>
      </motion.button>
      {/* Info debajo de la card — comparación rápida sin overlay sobre la
          imagen. Nombre + anime + (solo tras votar) link discreto a la ficha.
          Evitamos template literals dinámicos tipo `items-${side}` porque
          Tailwind no genera clases que no puede detectar estáticamente. */}
      <div
        className={`flex min-w-0 flex-col px-1 ${
          side === 'right' ? 'items-end text-right' : 'items-start text-left'
        }`}
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
})

function AnonVoteLimitModal({ open, onClose }) {
  const next = encodeURIComponent('/votar')
  // Este modal antes era un <div role="dialog">
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
