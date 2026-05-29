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
  fechaDelDia,
  personajeDelDia,
  safeStorage,
} from '../lib/games'
import PersonajeImg from '../components/PersonajeImg'
import PersonajeCutImg from '../components/PersonajeCutImg'
import { hasCut } from '../lib/cuts'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { getGameVisual } from '../data/visual-assets'

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
      'Adivina el personaje de anime del día por su imagen difuminada. 5 intentos. Comparte tu resultado estilo Wordle.',
    canonical: 'https://animeshowdown.dev/games/shadow-guess',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const dailyObjetivo = useMemo(
    () => personajeDelDia('guess-character', new Date(), catalogoPersonajes),
    [catalogoPersonajes],
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
      dailyObjetivo={dailyObjetivo}
      catalogoPersonajes={catalogoPersonajes}
    />
  )
}

function GuessCharacterGame({ dailyObjetivo, catalogoPersonajes }) {
  // El "daily" usa personajeDelDia (determinístico, compartible). Cuando
  // el user pulsa "Jugar otra" tras terminar, generamos un personaje
  // random sin determinismo y sin compartir — modo endless improvisado.
  const [extraObjetivo, setExtraObjetivo] = useState(null)
  const objetivo = extraObjetivo ?? dailyObjetivo
  const esExtra = extraObjetivo !== null
  const [estado, setEstado] = useState(() => loadEstado(dailyObjetivo.slug))

  // Persistir cambios SOLO del Daily (no de las partidas extras random).
  // En extra no queremos guardar nada — cada extra es efímera.
  useEffect(() => {
    if (esExtra) return
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        fecha: fechaDelDia(),
        slug: objetivo.slug,
        intentos: estado.intentos,
        pistaUsada: estado.pistaUsada,
        finalizado: estado.finalizado,
        acertado: estado.acertado,
      }),
    )
  }, [estado, objetivo.slug, esExtra])

  const intentosUsados = estado.intentos.length + (estado.pistaUsada ? 1 : 0)
  const restantes = MAX_INTENTOS - intentosUsados
  const blurPx = estado.finalizado ? 0 : Math.max(0, 32 - intentosUsados * 8)
  // Silueta REAL en los primeros intentos: con el recorte transparente,
  // brightness(0) pinta la figura en negro (sombra) y se va iluminando al
  // fallar. El difuminado anterior dejaba ver colores (pelo, ropa) y no
  // parecía una silueta. Sin recorte caemos al retrato difuminado completo.
  const usarSilueta = hasCut(objetivo.slug) && !estado.finalizado
  const brilloSilueta = Math.min(1, intentosUsados / 3)

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
    const random = catalogoPersonajes[Math.floor(Math.random() * catalogoPersonajes.length)]
    if (!random) return
    setExtraObjetivo(random)
    setEstado(loadEstado(random.slug, true))
  }

  /** Vuelve al daily — usado tras varias extras para volver al compartible. */
  const volverAlDaily = () => {
    setExtraObjetivo(null)
    setEstado(loadEstado(dailyObjetivo.slug))
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
            'Juego diario para adivinar un personaje de anime por una imagen difuminada con cinco intentos.',
          featureList: [
            'Personaje diario determinístico',
            'Imagen difuminada que se aclara tras cada fallo',
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
              : `Tienes ${restantes} intentos. Cada fallo aclara un poco la imagen.`}
          </p>
        </motion.header>

        {/* Ancho cómodo en móvil (antes la imagen quedaba diminuta capada a
            42vh ≈ 28vw de ancho). max-w-[min(78vw,320px)] la hace protagonista
            sin desbordar; en sm+ vuelve al max-w-sm original. */}
        <div
          className={`as-panel relative mx-auto mb-4 w-full max-w-[min(78vw,320px)] overflow-hidden rounded-2xl border transition-all duration-500 sm:mb-6 sm:max-w-sm ${
            estado.acertado
              ? 'border-success/60 shadow-aura-lg [--aura-color:rgb(52_211_153_/_0.55)]'
              : 'border-border'
          }`}
        >
          <div className="relative aspect-[2/3] w-full overflow-hidden bg-bg">
            {usarSilueta ? (
              <PersonajeCutImg
                slug={objetivo.slug}
                alt="Silueta del personaje"
                className="h-full w-full"
                imgClassName="transition-all duration-500"
                style={{
                  filter: `brightness(${brilloSilueta}) blur(${blurPx}px)`,
                  transform: 'scale(1.05)',
                }}
              />
            ) : (
              <PersonajeImg
                slug={objetivo.slug}
                alt={estado.finalizado ? objetivo.nombre : 'Personaje difuminado'}
                className="h-full w-full object-contain transition-all duration-500"
                style={{
                  filter: `blur(${blurPx}px)`,
                  transform: blurPx > 0 ? 'scale(1.05)' : 'scale(1)',
                }}
              />
            )}
            {estado.acertado && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 0.6, repeat: 1 }}
                  className="rounded-full border-2 border-success/80 bg-success/20 px-5 py-2 text-lg font-extrabold uppercase tracking-[0.2em] text-success backdrop-blur-sm"
                >
                  ¡Acertaste!
                </motion.div>
              </motion.div>
            )}
            {estado.finalizado && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4">
                <p className="text-[11px] uppercase tracking-wider text-fg-muted">
                  Era…
                </p>
                <p className="text-xl font-bold text-fg-strong">
                  {objetivo.nombre}
                </p>
                <p className="text-[12px] text-fg-muted">{objetivo.anime}</p>
              </div>
            )}
          </div>
        </div>

        {estado.pistaUsada && !estado.finalizado && (
          <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3 text-[13px]">
            <p className="text-gold">
              <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
              Pista: es del anime{' '}
              <strong className="font-semibold">{objetivo.anime}</strong>.
            </p>
          </div>
        )}

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
            className="as-panel inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-gold/40 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
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

function PanelResultado({ acertado, intentos, objetivo, pistaUsada }) {
  const totalIntentos = intentos.length + (pistaUsada ? 1 : 0)
  const perfecto = acertado && totalIntentos === 1 && !pistaUsada
  const squaresRaw = buildShareSquares(
    intentos.map((i) => i.acierto),
    MAX_INTENTOS,
  )
  const texto = buildGameShareText({
    game: 'Shadow Guess',
    date: fechaDelDia(),
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
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
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
              className="h-10 w-8 shrink-0 rounded object-cover object-top"
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
function loadEstado(slugObjetivo, forceReset = false) {
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
    if (parsed.fecha !== fechaDelDia() || parsed.slug !== slugObjetivo) {
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
