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
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import {
  fechaDelDia,
  personajeDelDia,
  safeStorage,
} from '../lib/games'
import {
  imagenPersonaje,
  personajes,
  getStatsPersonaje,
} from '../lib/personajes-core'
import { ocultaImgRota } from '../lib/imgFallback'

const MAX_INTENTOS = 6
const STORAGE_KEY = 'animeshowdown.anidel.v1'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Anidel — Wordle de personajes anime (Plan v2 §14.4).
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
 * <p>Sin atributos extendidos (género, época, color de pelo) que sería
 * la versión completa del Plan v2 §14.4 — esa queda para cuando llegue
 * Bloque 15 (`personaje_atributos`). Por ahora 3 dimensiones de
 * comparación funcionan bien.
 */
function AnidelPage() {
  useSeo({
    title: 'AniGrid · Anidel — Wordle de personajes anime',
    description:
      'Adivina el personaje secreto del día en 6 intentos. Pistas por anime, primera letra y ELO. Comparte tu resultado.',
  })

  const dailyObjetivo = useMemo(() => personajeDelDia('anidel'), [])
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
    const personaje = personajes.find((p) => p.slug === slug)
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
      direccionElo:
        elo === eloObjetivo ? 'eq' : elo < eloObjetivo ? 'up' : 'down',
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
    const random = personajes[Math.floor(Math.random() * personajes.length)]
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
          <span className="as-kicker border-emerald-500/45 bg-emerald-500/10 text-emerald-200">
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
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]">
            <p className="text-amber-200">
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
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-bg px-1 font-mono text-[10px] font-bold text-fg-strong">
              Aa
            </span>
            <span>Letra inicial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-bg text-[10px]">
              📺
            </span>
            <span>Anime</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-bg text-fg-strong">
              <ArrowUp className="h-3 w-3" />
            </span>
            <span>ELO objetivo</span>
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
              className="as-panel inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-amber-500/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
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
        <span className="h-7 w-7 rounded-md border border-border/50" />
        <span className="h-7 w-7 rounded-md border border-border/50" />
        <span className="h-7 w-7 rounded-md border border-border/50" />
      </div>
    )
  }
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border p-2 ${
        intento.acierto
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <img
          src={imagenPersonaje(intento.slug)}
          alt=""
          loading="lazy"
          onError={ocultaImgRota}
          className="h-9 w-7 shrink-0 rounded object-cover object-top"
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
        label="📺"
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
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
        ok
          ? 'bg-emerald-500/20 text-emerald-200'
          : 'bg-rose-500/15 text-rose-300/80'
      }`}
    >
      {label}
    </span>
  )
}

function SquaritoFlecha({ dir, elo }) {
  if (dir === 'eq')
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-200"
        title={`ELO ${elo} = objetivo`}
      >
        <Minus className="h-3.5 w-3.5" />
      </span>
    )
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-200"
      title={
        dir === 'up'
          ? `ELO ${elo} — el objetivo es mayor`
          : `ELO ${elo} — el objetivo es menor`
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
  const totalIntentos = intentos.length + (pistaUsada ? 1 : 0)
  const perfecto = acertado && totalIntentos === 1 && !pistaUsada

  // Squares Wordle-style detallados (3 por fila) van en el share text.
  // Para el panel visual usamos un emoji por intento: 🌸 si acertó, 🌟 si
  // tuvo 2 de 3 matches (cerca), 🍂 si todo rojo. Más legible visualmente.
  const squaresShare = intentos
    .map((i) => {
      if (i.acierto) return '🟩🟩🟩'
      const parts = [
        i.matchLetra ? '🟩' : '🟥',
        i.matchAnime ? '🟩' : '🟥',
        i.direccionElo === 'eq' ? '🟩' : '🟨',
      ]
      return parts.join('')
    })
    .join('\n')

  const squaresUI = intentos.map((i) => {
    if (i.acierto) return { ok: true, emoji: '🌸' }
    const matches =
      (i.matchLetra ? 1 : 0) +
      (i.matchAnime ? 1 : 0) +
      (i.direccionElo === 'eq' ? 1 : 0)
    return { ok: matches >= 2, emoji: matches >= 2 ? '🌟' : '🍂' }
  })

  const texto = `🎴 Anidel — ${fechaDelDia()}\n${
    acertado
      ? `✅ ${totalIntentos}/${MAX_INTENTOS}`
      : `❌ X/${MAX_INTENTOS} — era ${objetivo.nombre}`
  }${pistaUsada ? '  💡' : ''}\n${squaresShare}\nanimeshowdown.dev/games/anigrid`

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
      shareText={texto}
    >
      <p className="text-[12px] text-fg-muted">
        <Link to="/games" className="text-accent hover:underline">
          Volver al hub
        </Link>{' '}
        ·{' '}
        <Link
          to={`/personajes/${objetivo.slug}`}
          className="text-accent hover:underline"
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
