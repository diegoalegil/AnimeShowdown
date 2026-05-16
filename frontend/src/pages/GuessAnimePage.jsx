import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  Copy,
  Lightbulb,
  RotateCcw,
  Type,
  X,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompleteAnime from '../components/AutocompleteAnime'
import {
  buildShareSquares,
  fechaDelDia,
  personajeDelDia,
  safeStorage,
} from '../lib/games'
import { imagenPersonaje, personajes } from '../data/personajes'

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
 * <p>A diferencia de Guess the Character, aquí la imagen del personaje
 * se ve nítida desde el principio. Lo que hay que adivinar es de qué
 * anime es. 5 intentos. La pista opcional revela el nombre del
 * personaje y gasta un intento.
 */
function GuessAnimePage() {
  useSeo({
    title: 'Guess the Anime — Daily',
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
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Guess the Anime', path: '/games/guess-anime' },
        ])}
      />
      <div className="mx-auto max-w-2xl">
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-amber-200">
            <Type className="h-3 w-3" />
            Guess the Anime · Daily
          </span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
            ¿De qué anime es?
          </h1>
          <p className="text-[13px] text-fg-muted">
            {estado.finalizado
              ? 'Partida del día completada.'
              : `Tienes ${restantes} intentos.`}
          </p>
        </motion.header>

        <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-bg">
            <img
              src={imagenPersonaje(objetivo.slug)}
              alt="Personaje a identificar"
              className="h-full w-full object-cover object-top"
            />
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
              autoFocus
              filtroExtra={(anime) => !estado.intentos.some((i) => i.anime === anime)}
            />
            <button
              type="button"
              onClick={handlePista}
              disabled={estado.pistaUsada || restantes <= 1}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-amber-500/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
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

function PanelResultado({ acertado, intentos, objetivo, pistaUsada }) {
  const totalIntentos = intentos.length + (pistaUsada ? 1 : 0)
  const squares = buildShareSquares(
    intentos.map((i) => i.acierto),
    MAX_INTENTOS,
  )
  const texto = `📺 Guess the Anime — ${fechaDelDia()}\n${
    acertado
      ? `✅ Acerté en ${totalIntentos}/${MAX_INTENTOS}`
      : `❌ Era ${objetivo.anime} (${objetivo.nombre})`
  }\n${squares}${pistaUsada ? '  💡 pista usada' : ''}\nanimeshowdown.dev/games/guess-anime`

  const compartir = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Resultado copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div
      className={`mb-6 rounded-xl border p-5 ${
        acertado
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-rose-500/40 bg-rose-500/5'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {acertado ? (
          <Check className="h-5 w-5 text-emerald-300" />
        ) : (
          <X className="h-5 w-5 text-rose-300" />
        )}
        <p
          className={`text-sm font-bold ${
            acertado ? 'text-emerald-200' : 'text-rose-200'
          }`}
        >
          {acertado
            ? `¡Acertaste en ${totalIntentos}/${MAX_INTENTOS}!`
            : 'Sin intentos.'}
        </p>
      </div>
      <p className="mb-3 font-mono text-2xl tabular-nums tracking-wider">{squares}</p>
      <button
        type="button"
        onClick={compartir}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar resultado
      </button>
      <p className="mt-3 text-[12px] text-fg-muted">
        <Link to="/games" className="text-accent hover:underline">
          Volver al hub
        </Link>{' '}
        ·{' '}
        <Link
          to={`/personajes/${objetivo.slug}`}
          className="text-accent hover:underline"
        >
          Ver ficha
        </Link>
      </p>
    </div>
  )
}

function ListaIntentosAnime({ intentos }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
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
