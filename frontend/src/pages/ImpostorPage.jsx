import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
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
    title: 'Detector de Impostor — Daily',
    description:
      '5 cartas de anime, 4 del mismo, 1 intrusa. Pulsa el impostor antes de que pase el tiempo. 3 rondas al día.',
  })

  const rondas = useMemo(() => {
    const out = []
    const hoy = new Date()
    for (let r = 0; r < RONDAS_POR_DIA; r++) {
      // Offset por ronda restando segundos al día base — el seed cambia
      // por ronda pero queda determinístico para el mismo día.
      const seedDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, r)
      out.push(impostorDelDia(seedDate))
    }
    return out.filter(Boolean)
  }, [])

  const [estado, setEstado] = useState(() => loadEstado())
  const rondaActual = rondas[estado.rondaIdx]
  const finalizadoDia = estado.rondaIdx >= rondas.length

  useEffect(() => {
    safeStorage.set(
      STORAGE_KEY,
      JSON.stringify({
        fecha: fechaDelDia(),
        rondaIdx: estado.rondaIdx,
        resultados: estado.resultados,
      }),
    )
  }, [estado])

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

  const handleReset = () => {
    if (!confirm('¿Reiniciar el día?')) return
    setEstado(loadEstado(true))
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Anime Games', path: '/games' },
          { label: 'Detector de Impostor', path: '/games/impostor' },
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
            Detector de Impostor · Daily
          </span>
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
            Encuentra el impostor
          </h1>
          {finalizadoDia ? (
            <p className="text-[13px] text-fg-muted">
              Día completado. Vuelve mañana para nuevas rondas.
            </p>
          ) : (
            <p className="text-[13px] text-fg-muted">
              Ronda <strong className="text-fg-strong">{estado.rondaIdx + 1}</strong>{' '}
              de {rondas.length}. 4 personajes son del mismo anime, 1 no. ¿Cuál?
            </p>
          )}
        </motion.header>

        {!finalizadoDia && rondaActual && (
          <Ronda ronda={rondaActual} onEleccion={handleEleccion} />
        )}

        {finalizadoDia && (
          <PanelResultado
            resultados={estado.resultados}
            rondas={rondas}
          />
        )}

        <ProgresoRondas
          rondaActual={estado.rondaIdx}
          resultados={estado.resultados}
          total={rondas.length}
        />

        {finalizadoDia && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted transition-colors hover:text-accent"
            >
              <RotateCcw className="h-3 w-3" />
              Reiniciar (solo para testear)
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function Ronda({ ronda, onEleccion }) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-6">
      <div className="mb-5 flex items-center gap-2">
        <Timer className="h-4 w-4 text-purple-300" />
        <p className="text-[13px] text-fg-muted">
          Anime de los 4 normales:{' '}
          <strong className="text-fg-strong">{ronda.anime}</strong>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
      <div className="aspect-[2/3] w-full overflow-hidden bg-surface-alt">
        <img
          src={item.imagen}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top transition-transform group-hover:scale-105"
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

function PanelResultado({ resultados }) {
  const aciertos = resultados.filter(Boolean).length
  const total = resultados.length
  const squares = resultados.map((r) => (r ? '🟩' : '🟥')).join('')

  const texto = `🕵️ Detector de Impostor — ${fechaDelDia()}\n${aciertos}/${total} aciertos  ${squares}\nanimeshowdown.dev/games/impostor`

  const compartir = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Resultado copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div
      className={`mb-6 rounded-xl border p-5 ${
        aciertos === total
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : aciertos > 0
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-rose-500/40 bg-rose-500/5'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {aciertos === total ? (
          <Check className="h-5 w-5 text-emerald-300" />
        ) : aciertos > 0 ? (
          <Sparkles className="h-5 w-5 text-amber-300" />
        ) : (
          <X className="h-5 w-5 text-rose-300" />
        )}
        <p className="text-sm font-bold text-fg-strong">
          {aciertos}/{total} aciertos
        </p>
      </div>
      <p className="mb-3 font-mono text-2xl tabular-nums tracking-wider">
        {squares}
      </p>
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
        </Link>
      </p>
    </div>
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
