import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  Lightbulb,
  RotateCcw,
  Type,
  X,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompleteAnime from '../components/AutocompleteAnime'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import PersonajeImg from '../components/PersonajeImg'
import {
  buildShareSquares,
  fechaDelDia,
  personajeDelDia,
  safeStorage,
} from '../lib/games'
import { personajes } from '../lib/personajes-core'

const MAX_INTENTOS = 5
const STORAGE_KEY = 'animeshowdown.guess-anime.v1'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Guess the Anime — Daily (Plan v2 §14.3).
 *
 * <p>A diferencia de Guess the Character, aquí se intuye la carta del
 * personaje desde el principio con blur visual progresivo. Lo que hay
 * que adivinar es de qué anime es. 5 intentos. La pista opcional revela
 * el nombre del personaje y gasta un intento.
 */
function GuessAnimePage() {
  useSeo({
    title: 'Anime Reveal · Guess the Anime — Daily',
    description:
      'Ves al personaje, ¿de qué anime es? 5 intentos para acertar. Pista opcional revelando el nombre.',
  })

  const dailyObjetivo = useMemo(() => personajeDelDia('guess-anime'), [])
  const [extraObjetivo, setExtraObjetivo] = useState(null)
  const objetivo = extraObjetivo ?? dailyObjetivo
  const esExtra = extraObjetivo !== null
  const [estado, setEstado] = useState(() => loadEstado(dailyObjetivo.slug))

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

  const handleGuess = (animeElegido) => {
    if (estado.finalizado) return
    if (estado.intentos.some((i) => i.anime === animeElegido)) {
      toast.info('Ya probaste ese anime')
      return
    }
    const acierto = animeElegido === objetivo.anime
    const intentos = [...estado.intentos, { anime: animeElegido, acierto }]
    const finalizado =
      acierto || intentos.length + (estado.pistaUsada ? 1 : 0) >= MAX_INTENTOS
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

  const jugarOtra = () => {
    const random = personajes[Math.floor(Math.random() * personajes.length)]
    setExtraObjetivo(random)
    setEstado(loadEstado(random.slug, true))
  }

  const volverAlDaily = () => {
    setExtraObjetivo(null)
    setEstado(loadEstado(dailyObjetivo.slug))
  }

  return (
    <section className="as-stage as-stage-purple as-stage-visual as-stage-reveal px-5 py-5 sm:px-8 sm:py-10">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Anime Reveal', path: '/games/anime-reveal' },
        ])}
      />
      <div className="mx-auto max-w-5xl">
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
          <span className="as-kicker border-amber-500/45 bg-amber-500/10 text-amber-200">
            <Type className="h-3 w-3" />
            Anime Reveal · Daily
          </span>
          <h1 className="text-[clamp(2.2rem,6vw,4.6rem)] font-extrabold leading-tight tracking-tight">
            ¿De qué <span className="as-title-gradient">anime</span> es?
          </h1>
          <p className="text-[13px] text-fg-muted">
            {estado.finalizado
              ? 'Partida del día completada.'
              : `Tienes ${restantes} intentos.`}
          </p>
        </motion.header>

        {/* Nota visual (2026-05-18): cap mobile a 42vh para que el input
            quede dentro del primer viewport. Width sigue al aspect-ratio. */}
        <div
          className={`as-panel relative mx-auto mb-4 w-fit overflow-hidden rounded-2xl border transition-all duration-500 sm:mb-6 sm:w-auto sm:max-w-sm ${
            estado.acertado
              ? 'border-amber-400/60 shadow-[0_0_60px_-10px_rgba(251,191,36,0.55)]'
              : 'border-border'
          }`}
        >
          <div className="relative aspect-[2/3] h-[44vh] max-h-[440px] w-auto overflow-hidden bg-bg sm:h-auto sm:w-full">
            {/* Nota P1 (revisión externa 2026-05-18): el <img> plano
                no tenía fallback, así que personajes con imagen problemática
                (ej. roy_mustang con naturalWidth=0 reportado) salían como
                icono roto. PersonajeImg renderiza PersonajePlaceholder
                (kanji 戦 + iniciales + anime) si la carga falla — la
                ronda diaria queda jugable visualmente aunque el asset
                tenga issues puntuales. */}
            <PersonajeImg
              slug={objetivo.slug}
              alt="Personaje a identificar"
              className={`h-full w-full object-contain ${!estado.finalizado ? 'blur-lg scale-105 saturate-125' : ''}`}
            />
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
                  className="rounded-full border-2 border-amber-300/80 bg-amber-500/20 px-5 py-2 text-lg font-extrabold uppercase tracking-[0.2em] text-amber-100 backdrop-blur-sm"
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
                <p className="text-[12px] text-amber-200">{objetivo.anime}</p>
              </div>
            )}
          </div>
        </div>

        {estado.pistaUsada && !estado.finalizado && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]">
            <p className="text-amber-200">
              <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
              Pista: el personaje se llama{' '}
              <strong className="font-semibold">{objetivo.nombre}</strong>.
            </p>
          </div>
        )}

        {!estado.finalizado ? (
          <div className="mb-6 flex flex-col gap-2">
            <AutocompleteAnime
              onSelect={handleGuess}
              placeholder="¿De qué anime es?"
              autoFocus={false}
              filtroExtra={(anime) => !estado.intentos.some((i) => i.anime === anime)}
            />
            <button
              type="button"
              onClick={handlePista}
              disabled={estado.pistaUsada || restantes <= 1}
            className="as-panel inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-amber-500/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {estado.pistaUsada
                ? 'Pista ya usada'
                : `Pista: nombre del personaje (gasta 1 intento)`}
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
          <ListaIntentosAnime intentos={estado.intentos} />
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

function tierAnimePara(intentos, pistaUsada) {
  if (intentos === 1 && !pistaUsada) return 'Otaku certificado ✨'
  if (intentos === 1) return 'Otaku con pista'
  if (intentos === 2) return 'Ojo entrenado'
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
  const texto = `📺 Guess the Anime — ${fechaDelDia()}\n${
    acertado
      ? `✅ Acerté en ${totalIntentos}/${MAX_INTENTOS}`
      : `❌ Era ${objetivo.anime} (${objetivo.nombre})`
  }\n${squaresRaw}${pistaUsada ? '  💡 pista usada' : ''}\nanimeshowdown.dev/games/anime-reveal`

  const titulo = perfecto
    ? `PERFECT CLEAR · ${objetivo.anime}`
    : acertado
      ? `${objetivo.anime} · ${totalIntentos}/${MAX_INTENTOS}`
      : `Era ${objetivo.anime}`

  const tier = acertado
    ? tierAnimePara(totalIntentos, pistaUsada)
    : 'Mañana cazas el siguiente'

  return (
    <PanelResultadoAnime
      acertado={acertado}
      titulo={titulo}
      tier={tier}
      squares={intentos.map((i) => ({ ok: i.acierto }))}
      bonusBadge={pistaUsada ? { emoji: '💡', label: 'pista usada' } : null}
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

function ListaIntentosAnime({ intentos }) {
  return (
    <div className="as-panel rounded-xl p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        Tus intentos
      </p>
      <ul className="flex flex-col gap-2">
        {intentos.map((i, idx) => (
          <li
            key={`${i.anime}-${idx}`}
            className={`flex items-center gap-3 rounded-lg border p-2.5 ${
              i.acierto
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-border bg-bg'
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg-strong">
              {i.anime}
            </span>
            {i.acierto ? (
              <Check className="h-4 w-4 text-emerald-300" />
            ) : (
              <X className="h-4 w-4 text-rose-300/70" />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

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
    if (parsed.fecha !== fechaDelDia() || parsed.slug !== slugObjetivo) return inicial
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

export default GuessAnimePage
