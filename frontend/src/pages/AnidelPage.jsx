import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Grid3X3,
  Lightbulb,
  Minus,
  RotateCcw,
  Tv,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import GameCatalogLoading from '../components/GameCatalogLoading'
import {
  buildGameShareText,
  fechaDelDia,
  personajeDelDia,
  safeStorage,
} from '../lib/games'
import {
  getStatsPersonaje,
} from '../lib/personajes-core'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import PersonajeImg from '../components/PersonajeImg'
import { getGameVisual } from '../data/visual-assets'
import { getAnimeIdentity } from '../data/anime-identities'
import { slugifyAnime } from '../lib/animes'

const MAX_INTENTOS = 6
const STORAGE_KEY = 'animeshowdown.anidel.v1'
// El ELO base es sintético y casi todo el catálogo empata en una franja
// estrecha; una flecha ↑/↓ por cualquier diferencia mínima sería una pista
// "ciega" (engañosa). Solo damos dirección cuando el gap es significativo;
// por debajo del umbral mostramos "≈ parecido" (mismo tier), que es honesto.
const ELO_UMBRAL = 40
const SEO_IMAGE = getGameVisual('/games/anigrid').image

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

// 'up' = el objetivo tiene MÁS ELO base; 'down' = MENOS; 'cerca' = la
// diferencia está dentro del umbral (mismo tier, sin dirección fiable).
function direccionEloEntre(elo, eloObjetivo) {
  const delta = eloObjetivo - elo
  if (Math.abs(delta) < ELO_UMBRAL) return 'cerca'
  return delta > 0 ? 'up' : 'down'
}

/**
 * Anidel — Wordle de personajes anime.
 *
 * <p>Cada día un personaje secreto. 6 intentos. Tras cada intento se
 * compara con el objetivo por:
 * <ul>
 *   <li>Primera letra del nombre (✓ exacto / ✗ distinto).</li>
 *   <li>Anime (✓ mismo / ✗ distinto).</li>
 *   <li>ELO (flecha ↑ si el objetivo es mayor, ↓ si menor, − igual).</li>
 * </ul>
 *
 * <p>Pista opcional: revela una letra random del nombre del objetivo
 * que aún no se sepa. Gasta 1 intento.
 *
 * <p>Sin atributos extendidos (género, época, color de pelo) hasta que
 * el catálogo incorpore esos datos. Por ahora 3 dimensiones de
 * comparación mantienen el juego ligero.
 */
function AnidelPage() {
  useSeo({
    title: 'AniGrid · Anidel — Wordle de personajes anime',
    description:
      'Adivina el personaje secreto del día en 6 intentos. Pistas por anime, primera letra y ELO. Comparte tu resultado.',
    canonical: 'https://animeshowdown.dev/games/anigrid',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const dailyObjetivo = useMemo(
    () => personajeDelDia('anidel', new Date(), catalogoPersonajes),
    [catalogoPersonajes],
  )

  if (!dailyObjetivo) {
    return (
      <GameCatalogLoading
        kanji="格"
        title="Preparando AniGrid"
        description="Cargando catálogo para montar el personaje secreto."
      />
    )
  }

  return (
    <AnidelGame
      dailyObjetivo={dailyObjetivo}
      catalogoPersonajes={catalogoPersonajes}
    />
  )
}

function AnidelGame({ dailyObjetivo, catalogoPersonajes }) {
  const [extraObjetivo, setExtraObjetivo] = useState(null)
  const objetivo = extraObjetivo ?? dailyObjetivo
  const esExtra = extraObjetivo !== null
  const eloObjetivo = useMemo(() => getStatsPersonaje(objetivo.slug)?.elo ?? 1500, [
    objetivo.slug,
  ])
  const [estado, setEstado] = useState(() => loadEstado(dailyObjetivo.slug))

  useEffect(() => {
    if (esExtra) return
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        fecha: fechaDelDia(),
        slug: objetivo.slug,
        intentos: estado.intentos,
        pistaLetra: estado.pistaLetra,
        finalizado: estado.finalizado,
        acertado: estado.acertado,
      }),
    )
  }, [estado, objetivo.slug, esExtra])

  const intentosUsados = estado.intentos.length + (estado.pistaLetra ? 1 : 0)
  const restantes = MAX_INTENTOS - intentosUsados

  const handleGuess = (slug) => {
    if (estado.finalizado) return
    if (estado.intentos.some((i) => i.slug === slug)) {
      toast.info('Ya probaste ese personaje')
      return
    }
    const personaje = catalogoPersonajes.find((p) => p.slug === slug)
    if (!personaje) return
    const elo = getStatsPersonaje(personaje.slug)?.elo ?? 1500
    const acierto = slug === objetivo.slug
    const intento = {
      slug,
      nombre: personaje.nombre,
      anime: personaje.anime,
      elo,
      acierto,
      matchLetra:
        personaje.nombre.charAt(0).toUpperCase() ===
        objetivo.nombre.charAt(0).toUpperCase(),
      matchAnime: personaje.anime === objetivo.anime,
      direccionElo: direccionEloEntre(elo, eloObjetivo),
    }
    const intentos = [...estado.intentos, intento]
    const finalizado =
      acierto || intentos.length + (estado.pistaLetra ? 1 : 0) >= MAX_INTENTOS
    setEstado((s) => ({
      ...s,
      intentos,
      finalizado,
      acertado: acierto || s.acertado,
    }))
  }

  const handlePista = () => {
    if (estado.finalizado || estado.pistaLetra) return
    if (intentosUsados + 1 > MAX_INTENTOS) return
    // Revela una letra del nombre del objetivo en posición aleatoria
    // (excluyendo la primera, que ya se compara visualmente).
    const len = objetivo.nombre.length
    let pos = Math.max(1, Math.floor(Math.random() * len))
    if (pos >= len) pos = len - 1
    setEstado((s) => ({
      ...s,
      pistaLetra: {
        pos,
        letra: objetivo.nombre.charAt(pos),
        total: len,
      },
    }))
  }

  const jugarOtra = () => {
    const random = catalogoPersonajes[Math.floor(Math.random() * catalogoPersonajes.length)]
    if (!random) return
    setExtraObjetivo(random)
    setEstado(loadEstado(random.slug, true))
  }

  const volverAlDaily = () => {
    setExtraObjetivo(null)
    setEstado(loadEstado(dailyObjetivo.slug))
  }

  return (
    <section className="as-stage as-stage-cyan as-stage-visual as-stage-anigrid px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'AniGrid', path: '/games/anigrid' },
        ])}
      />
      <JsonLd
        id="game-anigrid"
        schema={gameWebApplicationSchema({
          name: 'AniGrid',
          alternateName: 'Anidel',
          path: '/games/anigrid',
          description:
            'Wordle diario de personajes anime con pistas por anime, primera letra y ELO base.',
          featureList: [
            'Personaje secreto diario',
            'Seis intentos',
            'Pistas por anime, inicial y ELO base',
            'Resultado compartible con cuadricula',
          ],
          keywords: [
            'wordle anime',
            'anigrid',
            'anidel',
            'adivina personaje anime',
          ],
        })}
      />
      <div className="mx-auto max-w-4xl">
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
            <Grid3X3 className="h-3 w-3" />
            AniGrid · Daily
          </span>
          <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] font-extrabold leading-tight tracking-tight">
            Wordle de personajes
          </h1>
          <p className="text-[13px] text-fg-muted">
            6 intentos para acertar el personaje secreto. Cada intento te dice
            si su anime, primera letra y ELO coinciden con el objetivo.
          </p>
        </motion.header>

        {estado.pistaLetra && !estado.finalizado && (
          <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3 text-[13px]">
            <p className="text-gold">
              <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
              Pista: el nombre tiene{' '}
              <strong className="font-semibold">{estado.pistaLetra.total}</strong>{' '}
              letras. La letra de la posición{' '}
              <strong className="font-semibold">
                {estado.pistaLetra.pos + 1}
              </strong>{' '}
              es{' '}
              <strong className="font-mono font-bold uppercase">
                {estado.pistaLetra.letra}
              </strong>
              .
            </p>
          </div>
        )}

        {/* Leyenda de columnas: neutral para no parecer una pista resuelta.
            En las filas, verde = coincide, rojo = no coincide, ámbar = dirección. */}
        <div className="as-panel mb-4 grid grid-cols-3 gap-2 rounded-lg p-3 text-[11px] text-fg-muted">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-border bg-bg px-1 font-mono text-[10px] font-bold text-fg-strong">
              Aa
            </span>
            <span>Letra inicial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg border border-border bg-bg text-fg-strong">
              <Tv className="h-3 w-3" />
            </span>
            <span>Anime</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg border border-border bg-bg text-fg-strong">
              <ArrowUp className="h-3 w-3" />
            </span>
            <span>ELO base objetivo</span>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2">
          {[...Array(MAX_INTENTOS)].map((_, i) => {
            const intento = estado.intentos[i]
            return (
              <FilaIntento
                key={i}
                intento={intento}
                isObjetivoElo={eloObjetivo}
              />
            )
          })}
        </div>

        {!estado.finalizado ? (
          <div className="mb-6 flex flex-col gap-2">
            <AutocompletePersonaje
              onSelect={handleGuess}
              placeholder={`Intento ${estado.intentos.length + 1}/${MAX_INTENTOS}…`}
              autoFocus
              filtroExtra={(p) => !estado.intentos.some((i) => i.slug === p.slug)}
            />
            <button
              type="button"
              onClick={handlePista}
              disabled={estado.pistaLetra || restantes <= 1}
              className="as-panel inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-gold/40 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {estado.pistaLetra
                ? 'Pista ya usada'
                : 'Revelar una letra (gasta 1 intento)'}
            </button>
          </div>
        ) : (
          <PanelResultado
            acertado={estado.acertado}
            intentos={estado.intentos}
            objetivo={objetivo}
            pistaUsada={Boolean(estado.pistaLetra)}
          />
        )}

        {estado.finalizado && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={jugarOtra}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <RotateCcw className="h-4 w-4" />
              Jugar otra ronda
            </button>
            {esExtra && (
              <button
                type="button"
                onClick={volverAlDaily}
                className="as-panel inline-flex items-center gap-1.5 rounded-lg px-4 py-3 text-[13px] font-semibold text-fg-muted transition-colors hover:text-fg-strong"
              >
                Volver al Daily
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function FilaIntento({ intento }) {
  if (!intento) {
    return (
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-dashed border-border bg-bg/40 p-2">
        <span className="text-[12px] text-fg-muted/50">·</span>
        <span className="h-7 w-7 rounded-lg border border-border/50" />
        <span className="h-7 w-7 rounded-lg border border-border/50" />
        <span className="h-7 w-7 rounded-lg border border-border/50" />
      </div>
    )
  }
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border p-2 ${
        intento.acierto
          ? 'border-success/40 bg-success/5'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <PersonajeImg
          slug={intento.slug}
          alt={intento.nombre}
          loading="lazy"
          sizes="36px"
          className="h-9 w-7 shrink-0 rounded-lg object-cover object-top"
        />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg-strong">
            {intento.nombre}
          </p>
          <p className="truncate text-[11px] text-fg-muted">{intento.anime}</p>
        </div>
      </div>
      <Squarito
        ok={intento.matchLetra}
        label={intento.nombre.charAt(0)}
        title={
          intento.matchLetra
            ? `La inicial ${intento.nombre.charAt(0).toUpperCase()} coincide`
            : `La inicial ${intento.nombre.charAt(0).toUpperCase()} no coincide`
        }
      />
      <Squarito
        ok={intento.matchAnime}
        label={<Tv className="h-3 w-3" />}
        title={intento.matchAnime ? 'Mismo anime' : 'Anime distinto'}
      />
      <SquaritoFlecha dir={intento.direccionElo} elo={intento.elo} />
    </div>
  )
}

function Squarito({ ok, label, title }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${
        ok
          ? 'bg-success/20 text-success'
          : 'bg-danger/15 text-danger/80'
      }`}
    >
      {label}
    </span>
  )
}

function SquaritoFlecha({ dir, elo }) {
  // 'cerca' (y el legacy 'eq' de estados guardados) = ELO base muy parecido:
  // mismo tier, sin dirección fiable. No usamos verde para no sugerir un match
  // exacto; ámbar con − indica "pista de proximidad, no de dirección".
  if (dir === 'cerca' || dir === 'eq')
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold"
        title={`ELO base ${elo} — muy parecido al objetivo (mismo tier)`}
      >
        <Minus className="h-3.5 w-3.5" />
      </span>
    )
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold"
      title={
        dir === 'up'
          ? `ELO base ${elo} — el objetivo tiene bastante más`
          : `ELO base ${elo} — el objetivo tiene bastante menos`
      }
    >
      {dir === 'up' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )}
    </span>
  )
}

function tierAnidelPara(intentos, pistaUsada) {
  if (intentos === 1 && !pistaUsada) return 'Telepatía pura ✨'
  if (intentos === 1) return 'Telepatía con pista'
  if (intentos <= 2) return 'Increíble deducción'
  if (intentos <= 4) return 'Bien hecho'
  return 'Justo a tiempo'
}

function PanelResultado({ acertado, intentos, objetivo, pistaUsada }) {
  const identity = getAnimeIdentity(slugifyAnime(objetivo.anime), objetivo.anime)
  const totalIntentos = intentos.length + (pistaUsada ? 1 : 0)
  const perfecto = acertado && totalIntentos === 1 && !pistaUsada

  // Squares Wordle-style detallados (3 por fila) van en el share text.
  // Para el panel visual usamos un emoji por intento: 🌸 si acertó, 🌟 si
  // tuvo 2 de 3 matches (cerca), 🍂 si todo rojo. Más legible visualmente.
  const squaresShare = intentos
    .map((i) => {
      if (i.acierto) return '🟩🟩🟩'
      const eloCerca = i.direccionElo === 'cerca' || i.direccionElo === 'eq'
      const parts = [
        i.matchLetra ? '🟩' : '🟥',
        i.matchAnime ? '🟩' : '🟥',
        eloCerca ? '🟩' : '🟨',
      ]
      return parts.join('')
    })
    .join('\n')

  const squaresUI = intentos.map((i) => {
    if (i.acierto) return { ok: true, emoji: '🌸' }
    const matches =
      (i.matchLetra ? 1 : 0) +
      (i.matchAnime ? 1 : 0) +
      (i.direccionElo === 'cerca' || i.direccionElo === 'eq' ? 1 : 0)
    return { ok: matches >= 2, emoji: matches >= 2 ? '🌟' : '🍂' }
  })

  const texto = buildGameShareText({
    game: 'AniGrid',
    date: fechaDelDia(),
    result: acertado ? `${totalIntentos}/${MAX_INTENTOS}` : `X/${MAX_INTENTOS}`,
    detail: acertado
      ? `Adiviné a ${objetivo.nombre}.`
      : `Era ${objetivo.nombre} (${objetivo.anime}).`,
    grid: `${squaresShare}${pistaUsada ? '\n💡 pista usada' : ''}`,
  })

  const titulo = perfecto
    ? `PERFECT CLEAR · ${objetivo.nombre}`
    : acertado
      ? `${objetivo.nombre} · ${totalIntentos}/${MAX_INTENTOS}`
      : `Era ${objetivo.nombre}`

  const tier = acertado
    ? tierAnidelPara(totalIntentos, pistaUsada)
    : `Era de ${objetivo.anime}. Mañana otra.`

  return (
    <PanelResultadoAnime
      acertado={acertado}
      titulo={titulo}
      tier={tier}
      squares={squaresUI}
      bonusBadge={pistaUsada ? { emoji: '💡', label: 'pista usada' } : null}
      shareTitle="AniGrid — AnimeShowdown"
      shareUrl="/games/anigrid"
      shareText={texto}
      identity={identity}
    >
      <p className="text-[12px] text-fg-muted">
        <Link to="/games" className="text-gold hover:underline">
          Volver al hub
        </Link>{' '}
        ·{' '}
        <Link
          to={`/personajes/${objetivo.slug}`}
          className="text-gold hover:underline"
        >
          Ver ficha de {objetivo.nombre}
        </Link>
      </p>
    </PanelResultadoAnime>
  )
}

function loadEstado(slugObjetivo, forceReset = false) {
  const inicial = {
    intentos: [],
    pistaLetra: null,
    finalizado: false,
    acertado: false,
  }
  if (forceReset) return inicial
  const raw = safeStorage.get(STORAGE_KEY)
  if (!raw) return inicial
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== fechaDelDia() || parsed.slug !== slugObjetivo) return inicial
    return {
      intentos: parsed.intentos ?? [],
      pistaLetra: parsed.pistaLetra ?? null,
      finalizado: Boolean(parsed.finalizado),
      acertado: Boolean(parsed.acertado),
    }
  } catch {
    return inicial
  }
}

export default AnidelPage
