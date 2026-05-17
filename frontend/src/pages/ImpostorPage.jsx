import { useEffect, useState } from 'react'
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
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import PanelResultadoAnime from '../components/PanelResultadoAnime'
import {
  fechaDelDia,
  impostorDelDia,
  safeStorage,
} from '../lib/games'

const RONDAS_POR_DIA = 3
const STORAGE_KEY = 'animeshowdown.impostor.v1'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function generarRondas(salt = '') {
  const out = []
  const hoy = new Date()
  for (let r = 0; r < RONDAS_POR_DIA; r++) {
    const ronda = impostorDelDia(hoy, `${salt}${r}`)
    if (ronda) out.push(ronda)
  }
  return out
}

/**
 * Detector de Impostor — Daily (Plan v2 §14.5).
 *
 * <p>Cada ronda muestra 5 cartas de personajes: 4 del mismo anime + 1
 * impostor de otro anime. Hay que pulsar el impostor antes de que se
 * agote el tiempo (15s en modo normal). 3 rondas por día.
 *
 * <p>Versión MVP sin "Hard" (impostor del mismo género/estética) ni
 * "Speed" (3s/ronda con combo) — requieren atributos extendidos del
 * Bloque 15 (`personaje_atributos`). Por ahora todos los impostores
 * son de un anime random distinto (Easy).
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
  })

  // Rondas en useState (no useMemo) para que jugarOtra pueda regenerarlas
  // con salt distinto sin cambiar el daily. El daily usa salt=String(r),
  // los extras usan salt único por tirada.
  const [rondas, setRondas] = useState(() => generarRondas())
  const [esExtra, setEsExtra] = useState(false)
  const [estado, setEstado] = useState(() => loadEstado())
  const rondaActual = rondas[estado.rondaIdx]
  const finalizadoDia = estado.rondaIdx >= rondas.length

  useEffect(() => {
    if (esExtra) return
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        fecha: fechaDelDia(),
        rondaIdx: estado.rondaIdx,
        resultados: estado.resultados,
      }),
    )
  }, [estado, esExtra])

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

  const jugarOtra = () => {
    setRondas(generarRondas(`extra-${Date.now()}-`))
    setEsExtra(true)
    setEstado({ rondaIdx: 0, resultados: [] })
  }

  const volverAlDaily = () => {
    setRondas(generarRondas())
    setEsExtra(false)
    setEstado(loadEstado())
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Impostor Trial', path: '/games/impostor-trial' },
        ])}
      />
      <div className="mx-auto max-w-3xl">
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-purple-200">
            <Sparkles className="h-3 w-3" />
            裏 · Impostor Trial · Daily
          </span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
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
          />
        )}

        {finalizadoDia && (
          <PanelResultado
            resultados={estado.resultados}
            rondas={rondas}
            esExtra={esExtra}
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
                className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-accent"
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

function Ronda({ ronda, rondaIdx, totalRondas, onEleccion }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-slate-900/30 p-6">
      {/* Kanji 裏 (ura, "reverso/oculto") como textura. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-4 select-none font-mono text-[7rem] leading-none text-purple-200 opacity-[0.06]"
      >
        裏
      </span>

      <div className="relative mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 items-center justify-center rounded-md bg-purple-500/20 px-2 font-mono text-[12px] font-extrabold text-purple-100">
            R{rondaIdx + 1}/{totalRondas}
          </span>
          <p className="text-[13px] text-fg-muted">
            Anime base:{' '}
            <strong className="text-fg-strong">{ronda.anime}</strong>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-purple-200/70">
          <Timer className="h-3 w-3" />
          Pulsa al traidor
        </span>
      </div>
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ronda.items.map((item) => (
          <Carta key={item.slug} item={item} onClick={() => onEleccion(item)} />
        ))}
      </div>
    </div>
  )
}

function Carta({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.nombre} de ${item.anime} — ¿impostor?`}
      className="group relative overflow-hidden rounded-lg border border-border bg-bg text-left transition-all hover:-translate-y-0.5 hover:border-purple-500/40"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-surface-alt">
        <img
          src={item.imagen}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain transition-transform group-hover:scale-105"
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
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-surface p-3">
      {[...Array(total)].map((_, i) => {
        const resultado = resultados[i]
        const esActual = i === rondaActual && resultado == null
        return (
          <span
            key={i}
            className={`inline-flex h-8 min-w-[3rem] items-center justify-center gap-1 rounded-md px-2 text-[12px] font-semibold ${
              resultado === true
                ? 'bg-emerald-500/20 text-emerald-200'
                : resultado === false
                  ? 'bg-rose-500/15 text-rose-300'
                  : esActual
                    ? 'border border-purple-500/40 bg-purple-500/10 text-purple-200'
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

function PanelResultado({ resultados, esExtra }) {
  const aciertos = resultados.filter(Boolean).length
  const total = resultados.length
  const acertado = aciertos > 0
  const perfecto = aciertos === total && total >= 3
  const squaresShare = resultados.map((r) => (r ? '🟩' : '🟥')).join('')

  const texto = `🕵️ Impostor Trial — ${fechaDelDia()}${esExtra ? ' (Extra)' : ''}\n${aciertos}/${total} aciertos  ${squaresShare}\nanimeshowdown.dev/games/impostor-trial`

  const titulo = perfecto
    ? `PERFECT CLEAR · ${aciertos}/${total} traidores detectados`
    : `${aciertos}/${total} traidores detectados`

  return (
    <PanelResultadoAnime
      acertado={acertado}
      titulo={titulo}
      tier={tierImpostorPara(aciertos, total)}
      squares={resultados.map((r) => ({ ok: r }))}
      shareText={texto}
    >
      <p className="text-[12px] text-fg-muted">
        <Link to="/games" className="text-accent hover:underline">
          Volver al hub
        </Link>
      </p>
    </PanelResultadoAnime>
  )
}

function loadEstado(forceReset = false) {
  const inicial = { rondaIdx: 0, resultados: [] }
  if (forceReset) return inicial
  const raw = safeStorage.get(STORAGE_KEY)
  if (!raw) return inicial
  try {
    const parsed = JSON.parse(raw)
    if (parsed.fecha !== fechaDelDia()) return inicial
    return {
      rondaIdx: parsed.rondaIdx ?? 0,
      resultados: parsed.resultados ?? [],
    }
  } catch {
    return inicial
  }
}

export default ImpostorPage
