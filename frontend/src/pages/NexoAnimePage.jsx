import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Network,
  RotateCcw,
  Shuffle,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import GameCatalogLoading from '../components/GameCatalogLoading'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import PersonajeImg from '../components/PersonajeImg'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { getGameVisual } from '../data/visual-assets'
import {
  buildGameShareText,
  dateFromDayKey,
  fechaDelDia,
  nexoAnimeDelDia,
  NEXO_ANIME_STORAGE_KEY,
  safeStorage,
} from '../lib/games'
import { useTodayKey } from '../hooks/useDailyGameState'

const SEO_IMAGE = getGameVisual('/games/nexo-anime').image

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function NexoAnimePage() {
  useSeo({
    title: 'Nexo Anime · Conexiones de personajes',
    description:
      'Empareja personajes que pertenecen al mismo anime en un reto diario de conexiones visuales.',
    canonical: 'https://animeshowdown.dev/games/nexo-anime',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const todayKey = useTodayKey()
  const dailyRound = useMemo(
    () => nexoAnimeDelDia(dateFromDayKey(todayKey), '', catalogoPersonajes),
    [catalogoPersonajes, todayKey],
  )

  if (!dailyRound) {
    return (
      <GameCatalogLoading
        kanji="結"
        title="Preparando Nexo Anime"
        description="Cargando catálogo para construir las parejas del día."
      />
    )
  }

  return (
    <NexoAnimeGame
      key={todayKey}
      todayKey={todayKey}
      catalogoPersonajes={catalogoPersonajes}
      dailyRound={dailyRound}
    />
  )
}

function NexoAnimeGame({ todayKey, catalogoPersonajes, dailyRound }) {
  const [round, setRound] = useState(dailyRound)
  const [esExtra, setEsExtra] = useState(false)
  const [estado, setEstado] = useState(() => loadEstado(dailyRound, todayKey))
  const matchedGroupIds = new Set(estado.matchedGroupIds)
  const selectedSlugs = new Set(estado.selectedSlugs)
  const matchedSlugs = new Set(
    round.cards
      .filter((card) => matchedGroupIds.has(card.groupId))
      .map((card) => card.slug),
  )

  useEffect(() => {
    if (esExtra) return
    safeStorage.set(
      NEXO_ANIME_STORAGE_KEY,
      JSON.stringify({
        fecha: todayKey,
        roundId: round.groups.map((g) => g.id).join('|'),
        matchedGroupIds: estado.matchedGroupIds,
        attempts: estado.attempts,
        errores: estado.errores,
        finalizado: estado.finalizado,
      }),
    )
  }, [estado, esExtra, round.groups, todayKey])

  const seleccionar = (card) => {
    if (estado.finalizado || matchedSlugs.has(card.slug)) return
    if (estado.selectedSlugs.includes(card.slug)) {
      setEstado((actual) => ({
        ...actual,
        selectedSlugs: actual.selectedSlugs.filter((slug) => slug !== card.slug),
      }))
      return
    }

    const firstSlug = estado.selectedSlugs[0]
    if (!firstSlug) {
      setEstado((actual) => ({
        ...actual,
        selectedSlugs: [card.slug],
      }))
      return
    }

    const firstCard = round.cards.find((item) => item.slug === firstSlug)
    if (!firstCard) return
    const acierto = firstCard.groupId === card.groupId
    const nextMatched = acierto
      ? [...estado.matchedGroupIds, card.groupId]
      : estado.matchedGroupIds
    const finalizado = nextMatched.length >= round.groups.length

    setEstado({
      selectedSlugs: [],
      matchedGroupIds: nextMatched,
      attempts: estado.attempts + 1,
      errores: estado.errores + (acierto ? 0 : 1),
      finalizado,
    })

    if (acierto) {
      toast.success(`Conexión: ${card.anime}`)
    } else {
      toast.error('No comparten anime')
    }
  }

  const jugarOtra = () => {
    const extraRound = nexoAnimeDelDia(new Date(), `extra-${Date.now()}`, catalogoPersonajes)
    if (!extraRound) return
    setRound(extraRound)
    setEsExtra(true)
    setEstado(blankEstado())
  }

  const volverAlDaily = () => {
    setRound(dailyRound)
    setEsExtra(false)
    setEstado(loadEstado(dailyRound, todayKey))
  }

  const shareText = buildGameShareText({
    game: 'Nexo Anime',
    result: estado.finalizado
      ? `${estado.attempts} intentos`
      : `${estado.matchedGroupIds.length}/${round.groups.length} nexos`,
    detail: `${estado.errores} errores · ${todayKey}`,
    grid: round.groups
      .map((group) => (matchedGroupIds.has(group.id) ? 'OK' : '--'))
      .join(' '),
    extra: 'AnimeShowdown',
  })

  return (
    <section className="as-stage as-stage-visual as-stage-nexo px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Nexo Anime', path: '/games/nexo-anime' },
        ])}
      />
      <JsonLd
        id="game-nexo-anime"
        schema={gameWebApplicationSchema({
          name: 'Nexo Anime',
          alternateName: 'Anime Connections',
          path: '/games/nexo-anime',
          description:
            'Reto diario de conexiones para emparejar personajes que pertenecen al mismo anime.',
          featureList: [
            'Cuatro parejas diarias',
            'Cartas visuales de personaje',
            'Progreso local',
            'Resultado compartible',
          ],
          keywords: [
            'conexiones anime',
            'anime connections',
            'juego parejas anime',
            'anime daily game',
          ],
        })}
      />

      <div className="mx-auto max-w-6xl">
        <Link
          to="/games"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub de juegos
        </Link>

        <motion.header
          className="mb-8 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="as-kicker border-success/45 bg-success/10 text-success">
            <Network className="h-3 w-3" />
            <span lang="ja">結</span> · Nexo Anime · Daily
          </span>
          <h1 className="text-[clamp(2.3rem,6vw,4.7rem)] font-extrabold leading-tight tracking-tight">
            Encuentra las conexiones.
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-fg-muted">
            Ocho cartas, cuatro universos. Cada pareja comparte anime; el reto
            está en reconocer vínculos sin que la parrilla te lo regale.
          </p>
        </motion.header>

        {estado.finalizado && (
          <PanelResultadoAnime
            acertado
            titulo={`Nexo resuelto en ${estado.attempts} intentos`}
            tier={`${estado.errores} errores · ${esExtra ? 'partida extra' : 'daily completado'}`}
            squares={round.groups.map((group) => ({
              ok: matchedGroupIds.has(group.id),
            }))}
            shareText={shareText}
            shareTitle="Nexo Anime — AnimeShowdown"
            shareUrl="/games/nexo-anime"
            kanji="結"
          >
            <button
              type="button"
              onClick={jugarOtra}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/55 px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Otra parrilla
            </button>
          </PanelResultadoAnime>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="as-panel rounded-2xl border border-border p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-success">
                  {estado.matchedGroupIds.length}/{round.groups.length} nexos
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-fg-strong">
                  {estado.finalizado ? 'Tablero resuelto' : 'Selecciona dos cartas'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {esExtra && (
                  <button
                    type="button"
                    onClick={volverAlDaily}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/50 px-3 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent/45 hover:text-gold"
                  >
                    Daily
                  </button>
                )}
                <button
                  type="button"
                  onClick={jugarOtra}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/50 px-3 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:border-accent/45 hover:text-gold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Barajar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {round.cards.map((card) => {
                const matched = matchedSlugs.has(card.slug)
                const selected = selectedSlugs.has(card.slug)
                return (
                  <button
                    key={card.slug}
                    type="button"
                    onClick={() => seleccionar(card)}
                    disabled={matched}
                    aria-pressed={selected}
                    className={`group relative min-h-[12rem] overflow-hidden rounded-xl border bg-bg/60 text-left transition-all sm:min-h-[14rem] ${
                      matched
                        ? 'border-success/50 opacity-75'
                        : selected
                          ? 'border-gold shadow-aura [--aura-color:var(--color-gold-aura-soft)]'
                          : 'border-border hover:border-accent/45'
                    }`}
                  >
                    {matched ? (
                      <PersonajeImg
                        slug={card.slug}
                        alt={card.nombre}
                        className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-bg/85 via-surface/70 to-bg/90 text-center">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-bg/45 text-gold/80">
                          <Network className="h-5 w-5" />
                        </span>
                        <span className="font-mono text-3xl font-black text-fg-muted/75">
                          {iniciales(card.nombre)}
                        </span>
                        <span className="px-3 text-[11px] font-semibold text-fg-muted/80">
                          Nexo pendiente
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
                    {matched && (
                      <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-success drop-shadow-scrim" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-sm font-black text-fg-strong drop-shadow-scrim">
                        {card.nombre}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="as-panel rounded-2xl border border-border p-5">
            <p className="text-[11px] font-bold text-gold">
              Parejas cerradas
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {round.groups.map((group) => {
                const matched = matchedGroupIds.has(group.id)
                return (
                  <div
                    key={group.id}
                    className={`rounded-xl border p-3 ${
                      matched
                        ? 'border-success/40 bg-success/10'
                        : 'border-border bg-bg/45'
                    }`}
                  >
                    <p className={`text-sm font-bold ${matched ? 'text-success' : 'text-fg-muted'}`}>
                      {matched ? group.anime : 'Anime oculto'}
                    </p>
                    <p className="mt-1 text-[12px] text-fg-muted">
                      {matched
                        ? group.items.map((item) => item.nombre).join(' + ')
                        : 'Encuentra la pareja en el tablero.'}
                    </p>
                  </div>
                )
              })}
            </div>
            <p className="mt-5 text-[12px] text-fg-muted" aria-live="polite">
              {estado.attempts} intentos · {estado.errores} errores
            </p>
          </aside>
        </div>
      </div>
    </section>
  )
}

function blankEstado() {
  return {
    selectedSlugs: [],
    matchedGroupIds: [],
    attempts: 0,
    errores: 0,
    finalizado: false,
  }
}

function iniciales(nombre) {
  return String(nombre)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function loadEstado(round, todayKey = fechaDelDia()) {
  const fallback = blankEstado()
  const raw = safeStorage.get(NEXO_ANIME_STORAGE_KEY)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    const roundId = round.groups.map((g) => g.id).join('|')
    if (parsed.fecha !== todayKey || parsed.roundId !== roundId) return fallback
    return {
      selectedSlugs: [],
      matchedGroupIds: Array.isArray(parsed.matchedGroupIds)
        ? parsed.matchedGroupIds.filter((id) => round.groups.some((g) => g.id === id))
        : [],
      attempts: Number.isFinite(parsed.attempts) ? parsed.attempts : 0,
      errores: Number.isFinite(parsed.errores) ? parsed.errores : 0,
      finalizado: parsed.finalizado === true,
    }
  } catch {
    return fallback
  }
}

export default NexoAnimePage
