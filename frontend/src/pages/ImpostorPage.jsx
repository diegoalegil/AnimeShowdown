import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  RotateCcw,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, gameWebApplicationSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import GameCatalogLoading from '../components/GameCatalogLoading'
import {
  buildGameShareText,
  dateFromDayKey,
  fechaDelDia,
  impostorDelDia,
  safeStorage,
} from '../lib/games'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { useTodayKey } from '../hooks/useDailyGameState'
import PersonajeImg from '../components/PersonajeImg'
import { getGameVisual } from '../data/visual-assets'
import { getAnimeIdentity } from '../data/anime-identities'
import { slugifyAnime } from '../lib/animes'

const RONDAS_POR_DIA = 3
const STORAGE_KEY = 'animeshowdown.impostor.v1'
const SEGUNDOS_POR_RONDA = 15
const SEO_IMAGE = getGameVisual('/games/impostor-trial').image

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function generarRondas(catalogoPersonajes, salt = '', date = new Date()) {
  const out = []
  for (let r = 0; r < RONDAS_POR_DIA; r++) {
    const ronda = impostorDelDia(date, `${salt}${r}`, catalogoPersonajes)
    if (ronda) out.push(ronda)
  }
  return out
}

/**
 * Detector de Impostor — Daily.
 *
 * <p>Cada ronda muestra 5 cartas de personajes: 4 del mismo anime + 1
 * impostor de otro anime. Hay que pulsar el impostor antes de que se
 * agote el tiempo (15s en modo normal). 3 rondas por día.
 *
 * <p>Modo actual sin "Hard" (impostor del mismo género/estética) ni
 * "Speed" (3s/ronda con combo), que requieren atributos extendidos en
 * el catálogo. Por ahora todos los impostores son de un anime random
 * distinto.
 *
 * <p>Determinístico por día con offset por ronda: la misma ronda en la
 * misma fecha siempre tiene el mismo set, pero las 3 rondas del día son
 * distintas entre sí.
 */
function ImpostorPage() {
  useSeo({
    title: 'Impostor Trial · Detector de Impostor — Daily',
    description:
      '5 cartas de anime, 4 del mismo, 1 intrusa. Pulsa el impostor antes de que pase el tiempo. 3 rondas al día.',
    canonical: 'https://animeshowdown.dev/games/impostor-trial',
    image: SEO_IMAGE,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const todayKey = useTodayKey()
  const rondasDaily = useMemo(
    () => generarRondas(catalogoPersonajes, '', dateFromDayKey(todayKey)),
    [catalogoPersonajes, todayKey],
  )

  if (rondasDaily.length === 0) {
    return (
      <GameCatalogLoading
        kanji="裏"
        title="Preparando Impostor Trial"
        description="Cargando personajes para construir las rondas del día."
      />
    )
  }

  return (
    <ImpostorGame
      key={todayKey}
      todayKey={todayKey}
      catalogoPersonajes={catalogoPersonajes}
      rondasDaily={rondasDaily}
    />
  )
}

function ImpostorGame({ todayKey, catalogoPersonajes, rondasDaily }) {
  // Rondas en useState (no useMemo) para que jugarOtra pueda regenerarlas
  // con salt distinto sin cambiar el daily. El daily usa salt=String(r),
  // los extras usan salt único por tirada.
  const [rondas, setRondas] = useState(rondasDaily)
  const [esExtra, setEsExtra] = useState(false)
  const [estado, setEstado] = useState(() => loadEstado(false, todayKey))
  const rondaActual = rondas[estado.rondaIdx]
  const finalizadoDia = estado.rondaIdx >= rondas.length

  useEffect(() => {
    if (esExtra) return
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        fecha: todayKey,
        rondaIdx: estado.rondaIdx,
        resultados: estado.resultados,
      }),
    )
  }, [estado, esExtra, todayKey])

  const handleEleccion = (item) => {
    if (finalizadoDia || !rondaActual) return
    const acierto = item.esImpostor
    if (acierto) {
      toast.success(`¡Acertaste! ${item.nombre} no es de ${rondaActual.anime}.`)
    } else {
      toast.error(`${item.nombre} sí es de ${rondaActual.anime}.`)
    }
    setEstado((s) => ({
      rondaIdx: s.rondaIdx + 1,
      resultados: [...s.resultados, acierto],
    }))
  }

  const handleTimeout = () => {
    if (finalizadoDia || !rondaActual) return
    toast.error(`Se acabó el tiempo. El impostor era de ${rondaActual.items.find((i) => i.esImpostor)?.anime ?? '?'}.`)
    setEstado((s) => ({
      rondaIdx: s.rondaIdx + 1,
      resultados: [...s.resultados, false],
    }))
  }

  const jugarOtra = () => {
    setRondas(generarRondas(catalogoPersonajes, `extra-${Date.now()}-`))
    setEsExtra(true)
    setEstado({ rondaIdx: 0, resultados: [] })
  }

  const volverAlDaily = () => {
    setRondas(rondasDaily)
    setEsExtra(false)
    setEstado(loadEstado(false, todayKey))
  }

  return (
    <section className="as-stage as-stage-purple as-stage-visual as-stage-impostor px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Impostor Trial', path: '/games/impostor-trial' },
        ])}
      />
      <JsonLd
        id="game-impostor-trial"
        schema={gameWebApplicationSchema({
          name: 'Impostor Trial',
          alternateName: 'Detector de Impostor',
          path: '/games/impostor-trial',
          description:
            'Juego diario para detectar qué personaje no pertenece al anime de la ronda antes de que se acabe el tiempo.',
          featureList: [
            'Tres rondas diarias',
            'Cinco cartas por ronda',
            'Un personaje intruso de otro anime',
            'Resultado compartible',
          ],
          keywords: [
            'juego impostor anime',
            'anime impostor',
            'detector de impostor',
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
          <span className="as-kicker border-rarity-epic/45 bg-rarity-epic/10 text-rarity-epic">
            <Sparkles className="h-3 w-3" />
            <span lang="ja">裏</span> · Impostor Trial · Daily
          </span>
          <h1 className="text-[clamp(2.4rem,6vw,4.6rem)] font-extrabold leading-tight tracking-tight">
            4 cartas. 1 traidor.
          </h1>
          {finalizadoDia ? (
            <p className="text-[13px] text-fg-muted">
              Día completado. Vuelve mañana para nuevas rondas.
            </p>
          ) : (
            <p className="text-[13px] text-fg-muted">
              Detecta quién no pertenece al anime antes de que se acabe la
              ronda. Tres rondas, tres oportunidades.
            </p>
          )}
        </motion.header>

        {!finalizadoDia && rondaActual && (
          <Ronda
            key={`${esExtra ? 'x' : 'd'}-${estado.rondaIdx}`}
            ronda={rondaActual}
            rondaIdx={estado.rondaIdx}
            totalRondas={rondas.length}
            onEleccion={handleEleccion}
            onTimeout={handleTimeout}
          />
        )}

        {finalizadoDia && (
          <PanelResultado
            resultados={estado.resultados}
            rondas={rondas}
            esExtra={esExtra}
            todayKey={todayKey}
          />
        )}

        <ProgresoRondas
          rondaActual={estado.rondaIdx}
          resultados={estado.resultados}
          total={rondas.length}
        />

        {finalizadoDia && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={jugarOtra}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <RotateCcw className="h-4 w-4" />
              Jugar otra ronda
            </button>
            {esExtra && (
              <button
                type="button"
                onClick={volverAlDaily}
                className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-gold"
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

function Ronda({ ronda, rondaIdx, totalRondas, onEleccion, onTimeout }) {
  // El `key` del componente cambia al avanzar de ronda, así que useState
  // reinicializa automáticamente el timer sin reset manual.
  const [segundos, setSegundos] = useState(SEGUNDOS_POR_RONDA)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (locked) return
    if (segundos <= 0) return
    const id = setTimeout(() => {
      if (segundos <= 1) {
        setLocked(true)
        setSegundos(0)
        onTimeout?.()
        return
      }
      setSegundos((s) => s - 1)
    }, 1000)
    return () => clearTimeout(id)
    // onTimeout no se incluye en deps a propósito: viene del padre y es
    // estable durante la vida del componente (key cambia al avanzar de
    // ronda). Incluirla causaría re-disparos espurios del timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, locked])

  const porcentajeRestante = (segundos / SEGUNDOS_POR_RONDA) * 100
  const critico = segundos <= 5
  const handleEleccion = (item) => {
    if (locked) return
    setLocked(true)
    onEleccion(item)
  }

  return (
    <div className="as-panel relative mb-6 overflow-hidden rounded-2xl border-rarity-epic/30 p-6">
      {/* Kanji 裏 (ura, "reverso/oculto") como textura. */}
      <span
        aria-hidden="true"
        lang="ja"
        className="pointer-events-none absolute -right-2 -top-4 select-none font-mono text-[7rem] leading-none text-rarity-epic opacity-[0.06]"
      >
        裏
      </span>

      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 items-center justify-center rounded-lg bg-rarity-epic/20 px-2 font-mono text-[12px] font-extrabold text-rarity-epic">
            R{rondaIdx + 1}/{totalRondas}
          </span>
          <p className="text-[13px] text-fg-muted">
            Anime base:{' '}
            <strong className="text-fg-strong">{ronda.anime}</strong>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 font-mono text-[12px] font-bold tabular-nums ${
            critico ? 'text-danger' : 'text-rarity-epic'
          }`}
          aria-live="polite"
        >
          <Timer className={`h-3 w-3 ${critico ? 'animate-pulse' : ''}`} />
          0:{String(Math.max(0, segundos)).padStart(2, '0')}
        </span>
      </div>

      {/* Barra visual de tiempo. ARIA con valuemin/now/max para que SR
          anuncien progreso. transition lineal en width para que se vea
          cómo baja en tiempo real, sin "saltos" entre segundos. */}
      <div
        role="progressbar"
        aria-valuenow={segundos}
        aria-valuemin={0}
        aria-valuemax={SEGUNDOS_POR_RONDA}
        aria-label="Tiempo restante de la ronda"
        className="relative mb-5 h-1.5 overflow-hidden rounded-full bg-bg/60"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            critico
              ? 'bg-gradient-to-r from-danger via-danger to-medal-bronze'
              : 'bg-gradient-to-r from-rarity-epic via-rarity-epic to-arc-waifu'
          }`}
          style={{ width: `${porcentajeRestante}%` }}
        />
      </div>

      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ronda.items.map((item) => (
          <Carta
            key={item.slug}
            item={item}
            disabled={locked}
            onClick={() => handleEleccion(item)}
          />
        ))}
      </div>
    </div>
  )
}

function Carta({ item, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${item.nombre} de ${item.anime} — ¿impostor?`}
      className="as-ssr-card group relative overflow-hidden rounded-xl text-left transition-all hover:-translate-y-0.5 hover:border-rarity-epic/60 disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:translate-y-0"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-surface-alt">
        <PersonajeImg
          slug={item.slug}
          src={item.imagen}
          alt={item.nombre}
          loading="lazy"
          sizes="(min-width: 1024px) 180px, (min-width: 640px) 28vw, 45vw"
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5">
        <p className="text-[12px] font-bold text-fg-strong">{item.nombre}</p>
      </div>
    </button>
  )
}

function ProgresoRondas({ rondaActual, resultados, total }) {
  return (
    <div className="as-panel flex flex-wrap items-center justify-center gap-2 rounded-lg p-3">
      {[...Array(total)].map((_, i) => {
        const resultado = resultados[i]
        const esActual = i === rondaActual && resultado == null
        return (
          <span
            key={i}
            className={`inline-flex h-8 min-w-[3rem] items-center justify-center gap-1 rounded-lg px-2 text-[12px] font-semibold ${
              resultado === true
                ? 'bg-success/20 text-success'
                : resultado === false
                  ? 'bg-danger/15 text-danger'
                  : esActual
                    ? 'border border-rarity-epic/40 bg-rarity-epic/10 text-rarity-epic'
                    : 'border border-border bg-bg text-fg-muted'
            }`}
          >
            R{i + 1}
            {resultado === true && <Check className="h-3 w-3" />}
            {resultado === false && <X className="h-3 w-3" />}
          </span>
        )
      })}
    </div>
  )
}

function tierImpostorPara(aciertos, total) {
  if (aciertos === total && total >= 3) return 'Detective infalible ✨'
  if (aciertos === total) return 'Sin fallos'
  if (aciertos >= 2) return 'Buen ojo'
  if (aciertos === 1) return 'Ronda salvada'
  return 'Engaño total'
}

function PanelResultado({ resultados, rondas, esExtra, todayKey }) {
  const aciertos = resultados.filter(Boolean).length
  const total = resultados.length
  const acertado = aciertos > 0
  const perfecto = aciertos === total && total >= 3
  const squaresShare = resultados.map((r) => (r ? '🟩' : '🟥')).join('')
  const baseAnime = rondas?.[0]?.anime
  const identity = baseAnime
    ? getAnimeIdentity(slugifyAnime(baseAnime), baseAnime)
    : null

  const texto = buildGameShareText({
    game: 'Impostor Trial',
    date: todayKey,
    result: `${aciertos}/${total}`,
    detail: esExtra ? 'Ronda extra completada.' : 'Daily completado.',
    grid: squaresShare,
  })

  const titulo = perfecto
    ? `PERFECT CLEAR · ${aciertos}/${total} traidores detectados`
    : `${aciertos}/${total} traidores detectados`

  return (
    <PanelResultadoAnime
      acertado={acertado}
      titulo={titulo}
      tier={tierImpostorPara(aciertos, total)}
      squares={resultados.map((r) => ({ ok: r }))}
      shareTitle="Impostor Trial — AnimeShowdown"
      shareUrl="/games/impostor-trial"
      shareText={texto}
      identity={identity}
    >
      <p className="text-[12px] text-fg-muted">
        <Link to="/games" className="text-gold hover:underline">
          Volver al hub
        </Link>
      </p>
    </PanelResultadoAnime>
  )
}

function loadEstado(forceReset = false, todayKey = fechaDelDia()) {
  const inicial = { rondaIdx: 0, resultados: [] }
  if (forceReset) return inicial
  const raw = safeStorage.get(STORAGE_KEY)
  if (!raw) return inicial
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== todayKey) return inicial
    return {
      rondaIdx: parsed.rondaIdx ?? 0,
      resultados: parsed.resultados ?? [],
    }
  } catch {
    return inicial
  }
}

export default ImpostorPage
