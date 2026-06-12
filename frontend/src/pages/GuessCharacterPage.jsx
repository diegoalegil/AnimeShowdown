import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  Eye,
  Lightbulb,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import GameCatalogLoading from '../components/GameCatalogLoading'
import {
  buildGameShareText,
  buildShareSquares,
  dateFromDayKey,
  fechaDelDia,
  personajeDelDia,
  safeStorage,
} from '../lib/games'
import PersonajeImg from '../components/PersonajeImg'
import ShadowByobu from '../features/games/shadow/ShadowByobu'
import { hasCut, cutUrl } from '../lib/cuts'
import { imagenPersonaje } from '../lib/personajes-core'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { useTodayKey } from '../hooks/useDailyGameState'
import { getGameVisual } from '../data/visual-assets'
import { getAnimeIdentity } from '../data/anime-identities'
import { slugifyAnime } from '../lib/animes'

const MAX_INTENTOS = 5
const STORAGE_KEY = 'animeshowdown.guess-character.v1'
const SEO_IMAGE = getGameVisual('/games/shadow-guess').image

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Guess the Character — Daily.
 *
 * <p>Imagen del personaje del día con blur. Cada intento fallido reduce
 * el blur (32px → 24px → 16px → 8px → 0px). 5 intentos máximos.
 *
 * <p>Pista opcional: gasta un intento para revelar el anime. Mejor
 * usarla cuando el blur ya está bajo y aún no aciertas.
 *
 * <p>Persistencia: state guardado por fecha en localStorage. Si vuelves
 * el mismo día, ves dónde te quedaste.
 */
function GuessCharacterPage() {
  useSeo({
    title: 'Shadow Guess · Guess the Character — Daily',
    description:
      'Adivina el personaje de anime del día: su sombra vive tras un biombo. 5 intentos. Comparte tu resultado estilo Wordle.',
    canonical: 'https://animeshowdown.dev/games/shadow-guess',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const todayKey = useTodayKey()
  // El biombo necesita silueta real (recorte alpha → negro): el daily se
  // elige SOLO entre personajes con recorte (~80% del catálogo). Sigue
  // siendo determinista y el mismo para todo el mundo.
  const candidatos = useMemo(
    () => catalogoPersonajes.filter((p) => hasCut(p.slug)),
    [catalogoPersonajes],
  )
  const dailyObjetivo = useMemo(
    () => personajeDelDia('guess-character', dateFromDayKey(todayKey), candidatos),
    [candidatos, todayKey],
  )

  if (!dailyObjetivo) {
    return (
      <GameCatalogLoading
        kanji="影"
        title="Preparando Shadow Guess"
        description="Cargando personajes para elegir la silueta diaria."
      />
    )
  }

  return (
    <GuessCharacterGame
      key={todayKey}
      todayKey={todayKey}
      dailyObjetivo={dailyObjetivo}
      catalogoPersonajes={catalogoPersonajes}
      candidatos={candidatos}
    />
  )
}

function GuessCharacterGame({ todayKey, dailyObjetivo, catalogoPersonajes, candidatos }) {
  // El "daily" usa personajeDelDia (determinístico, compartible). Cuando
  // el user pulsa "Jugar otra" tras terminar, generamos un personaje
  // random sin determinismo y sin compartir — modo endless improvisado.
  const [extraObjetivo, setExtraObjetivo] = useState(null)
  const objetivo = extraObjetivo ?? dailyObjetivo
  const esExtra = extraObjetivo !== null
  const [estado, setEstado] = useState(() => loadEstado(dailyObjetivo.slug, false, todayKey))

  // Persistir cambios SOLO del Daily (no de las partidas extras random).
  // En extra no queremos guardar nada — cada extra es efímera.
  useEffect(() => {
    if (esExtra) return
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        fecha: todayKey,
        slug: objetivo.slug,
        intentos: estado.intentos,
        pistaUsada: estado.pistaUsada,
        finalizado: estado.finalizado,
        acertado: estado.acertado,
      }),
    )
  }, [estado, objetivo.slug, esExtra, todayKey])

  const intentosUsados = estado.intentos.length + (estado.pistaUsada ? 1 : 0)
  const restantes = MAX_INTENTOS - intentosUsados
  // Cada fallo (y la pista, que cuesta un intento) abre un panel del
  // biombo — máximo 4 paneles; el 5º intento se juega a biombo abierto.
  const fallos = Math.min(
    4,
    estado.intentos.filter((i) => !i.acierto).length + (estado.pistaUsada ? 1 : 0),
  )
  const resultado = estado.finalizado ? (estado.acertado ? 'acierto' : 'derrota') : null

  const handleGuess = (slug) => {
    if (estado.finalizado) return
    if (estado.intentos.some((i) => i.slug === slug)) {
      toast.info('Ya probaste ese personaje')
      return
    }
    const personaje = catalogoPersonajes.find((p) => p.slug === slug)
    if (!personaje) return
    const acierto = slug === objetivo.slug
    const intentos = [
      ...estado.intentos,
      { slug, nombre: personaje.nombre, anime: personaje.anime, acierto },
    ]
    const finalizado = acierto || intentos.length + (estado.pistaUsada ? 1 : 0) >= MAX_INTENTOS
    setEstado((s) => ({
      ...s,
      intentos,
      finalizado,
      acertado: acierto || s.acertado,
    }))
  }

  const handlePista = () => {
    if (estado.finalizado || estado.pistaUsada) return
    if (intentosUsados + 1 > MAX_INTENTOS) return
    setEstado((s) => ({ ...s, pistaUsada: true }))
  }

  /** Genera nueva partida con personaje random (no comparable con otros) */
  const jugarOtra = () => {
    const random = candidatos[Math.floor(Math.random() * candidatos.length)]
    if (!random) return
    setExtraObjetivo(random)
    setEstado(loadEstado(random.slug, true, todayKey))
  }

  /** Vuelve al daily — usado tras varias extras para volver al compartible. */
  const volverAlDaily = () => {
    setExtraObjetivo(null)
    setEstado(loadEstado(dailyObjetivo.slug, false, todayKey))
  }

  return (
    <section className="as-stage as-stage-visual as-stage-shadow px-5 py-5 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Shadow Guess', path: '/games/shadow-guess' },
        ])}
      />
      <JsonLd
        id="game-shadow-guess"
        schema={gameWebApplicationSchema({
          name: 'Shadow Guess',
          alternateName: 'Guess the Character',
          path: '/games/shadow-guess',
          description:
            'Juego diario para adivinar un personaje de anime oculto tras un biombo retroiluminado, con cinco intentos.',
          featureList: [
            'Personaje diario determinístico',
            'Biombo de cuatro paneles que se abre con cada fallo',
            'Pista opcional del anime',
            'Resultado compartible estilo Wordle',
          ],
          keywords: [
            'adivina personaje anime',
            'guess the character anime',
            'anime daily game',
            'shadow guess',
          ],
        })}
      />
      <div className="mx-auto max-w-4xl">
        <Link
          to="/games"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong sm:mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub de juegos
        </Link>
        <motion.header
          className="mb-4 flex flex-col items-center gap-2 text-center sm:mb-8 sm:gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="as-kicker border-danger/45 bg-danger/10 text-danger">
            <Eye className="h-3 w-3" />
            Shadow Guess · Daily
          </span>
          <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] font-extrabold leading-tight tracking-tight">
            ¿Quién es este personaje?
          </h1>
          <p className="text-[13px] text-fg-muted">
            {estado.finalizado
              ? 'Partida del día completada. Comparte tu resultado o vuelve mañana.'
              : `Tienes ${restantes} intentos. Cada fallo abre un panel del biombo.`}
          </p>
        </motion.header>

        {/* El biombo: la silueta vive detrás de 4 paneles de papel
            retroiluminados; cada fallo desliza uno. La escena gestiona
            pista, revelado del acierto y placa de derrota. */}
        <div className="mx-auto mb-4 w-full max-w-2xl sm:mb-6">
          <ShadowByobu
            siluetaSrc={cutUrl(objetivo.slug)}
            arteSrc={imagenPersonaje(objetivo.slug)}
            personaje={{ nombre: objetivo.nombre, anime: objetivo.anime }}
            fallos={fallos}
            resultado={resultado}
            pistaVisible={estado.pistaUsada}
          />
        </div>

        {!estado.finalizado ? (
          <div className="mb-6 flex flex-col gap-2">
            <AutocompletePersonaje
              onSelect={handleGuess}
              placeholder="Adivina el personaje…"
              autoFocus
              filtroExtra={(p) => !estado.intentos.some((i) => i.slug === p.slug)}
            />
            <button
              type="button"
              onClick={handlePista}
              disabled={estado.pistaUsada || restantes <= 1}
            className="as-panel inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-gold/40 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {estado.pistaUsada
                ? 'Pista ya usada'
                : `Usar pista (gasta 1 intento, te quedan ${restantes})`}
            </button>
          </div>
        ) : (
          <PanelResultado
            acertado={estado.acertado}
            intentos={estado.intentos}
            objetivo={objetivo}
            pistaUsada={estado.pistaUsada}
            todayKey={todayKey}
          />
        )}

        {estado.intentos.length > 0 && (
          <ListaIntentos intentos={estado.intentos} objetivo={objetivo} />
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-fg-muted transition-colors hover:text-fg-strong"
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

// Tiers de precisión según en qué intento aciertes. Sin pista penaliza
// más alto en la jerarquía; con pista cap a "Aceptable" como mucho.
function tierPara(intentos, pistaUsada) {
  if (intentos === 1 && !pistaUsada) return 'Precisión legendaria ✨'
  if (intentos === 1) return 'Precisión legendaria con pista'
  if (intentos === 2) return 'Increíble reflejo'
  if (intentos === 3) return 'Bien hecho'
  if (intentos === 4) return 'Por los pelos'
  return 'Justo a tiempo'
}

function PanelResultado({ acertado, intentos, objetivo, pistaUsada, todayKey }) {
  const identity = getAnimeIdentity(slugifyAnime(objetivo.anime), objetivo.anime)
  const totalIntentos = intentos.length + (pistaUsada ? 1 : 0)
  const perfecto = acertado && totalIntentos === 1 && !pistaUsada
  const squaresRaw = buildShareSquares(
    intentos.map((i) => i.acierto),
    MAX_INTENTOS,
  )
  const texto = buildGameShareText({
    game: 'Shadow Guess',
    date: todayKey,
    result: acertado ? `${totalIntentos}/${MAX_INTENTOS}` : `X/${MAX_INTENTOS}`,
    detail: acertado
      ? 'Acerté el personaje oculto.'
      : `Era ${objetivo.nombre} (${objetivo.anime}).`,
    grid: `${squaresRaw}${pistaUsada ? '  💡 pista usada' : ''}`,
  })

  const titulo = perfecto
    ? 'PERFECT CLEAR · Acertaste en 1 intento'
    : acertado
      ? `Acertaste en ${totalIntentos}/${MAX_INTENTOS}`
      : `Era ${objetivo.nombre}`

  const tier = acertado ? tierPara(totalIntentos, pistaUsada) : 'Mañana cazas la siguiente'

  return (
    <PanelResultadoAnime
      acertado={acertado}
      titulo={titulo}
      tier={tier}
      squares={intentos.map((i) => ({ ok: i.acierto }))}
      bonusBadge={pistaUsada ? { emoji: '💡', label: 'pista usada' } : null}
      shareTitle="Shadow Guess — AnimeShowdown"
      shareUrl="/games/shadow-guess"
      shareText={texto}
      identity={identity}
    >
      <p className="text-[12px] text-fg-muted">
        Próxima partida a medianoche local.{' '}
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

function ListaIntentos({ intentos, objetivo }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 text-[11px] font-semibold text-fg-muted">
        Tus intentos
      </p>
      <ul className="flex flex-col gap-2">
        {intentos.map((i, idx) => (
          <li
            key={`${i.slug}-${idx}`}
            className={`flex items-center gap-3 rounded-lg border p-2.5 ${
              i.acierto
                ? 'border-success/40 bg-success/5'
                : 'border-border bg-bg'
            }`}
          >
            <PersonajeImg
              slug={i.slug}
              alt={i.nombre}
              loading="lazy"
              sizes="40px"
              className="h-10 w-8 shrink-0 rounded-lg object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-fg-strong">
                {i.nombre}
              </p>
              <p className="truncate text-[11px] text-fg-muted">{i.anime}</p>
            </div>
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 ${
                i.anime === objetivo.anime ? 'text-gold' : 'text-fg-muted/30'
              }`}
              aria-label={
                i.anime === objetivo.anime
                  ? 'Mismo anime que el objetivo'
                  : 'Anime distinto'
              }
            />
            {i.acierto ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <X className="h-4 w-4 text-danger/70" />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Carga el estado del día desde localStorage. Si la fecha o el slug
 * cambiaron (medianoche o personaje distinto al esperado), empieza
 * partida nueva.
 */
function loadEstado(slugObjetivo, forceReset = false, todayKey = fechaDelDia()) {
  const inicial = {
    intentos: [],
    pistaUsada: false,
    finalizado: false,
    acertado: false,
  }
  if (forceReset) return inicial
  const raw = safeStorage.get(STORAGE_KEY)
  if (!raw) return inicial
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== todayKey || parsed.slug !== slugObjetivo) {
      return inicial
    }
    return {
      intentos: parsed.intentos ?? [],
      pistaUsada: Boolean(parsed.pistaUsada),
      finalizado: Boolean(parsed.finalizado),
      acertado: Boolean(parsed.acertado),
    }
  } catch {
    return inicial
  }
}

export default GuessCharacterPage
