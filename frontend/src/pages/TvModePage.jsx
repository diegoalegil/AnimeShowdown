import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Tv } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import {
  getStatsPersonaje,
} from '../lib/personajes-core'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import PersonajeImg from '../components/PersonajeImg'

/**
 * TV Mode — vista pantalla completa sin chrome de la
 * SPA. Pensada para streamers que quieren mostrar AnimeShowdown en su
 * stream, museos digitales, pantallas de eventos, etc.
 *
 * <p>Auto-rotación cada 10s entre 3 vistas: Top ELO base, personaje aleatorio
 * (con stats grandes), y un "trending" mock (top 3 por win-rate). Sin
 * navegación, sin scroll, sin clicks (pero con Esc para volver).
 *
 * <p>Sin backend — todo derivado del catálogo cliente-side. Funciona
 * offline tras primer load gracias al PWA. Ideal para una raspberry pi
 * en bucle en un sitio del local de un fan.
 *
 * <p>z-index 50 para tapar al header/footer. position fixed para que
 * scroll del body no afecte.
 */
const VISTAS = ['top10', 'spotlight', 'matchup']
const DURACION_S = 10

function pickRandom(arr, seed) {
  if (!arr.length) return null
  // No usamos Math.random aquí para que el seed cycling produzca el
  // mismo personaje en el mismo tick (predecible en tests).
  const idx = (seed * 2654435761) >>> 0
  return arr[idx % arr.length]
}

function TvModePage() {
  useSeo({
    title: 'TV Mode',
    description:
      'Vista pantalla completa para streamers. Rotación de top ELO, personaje destacado y matchup random.',
    noindex: true,
  })
  const { personajes } = usePersonajesCatalogo()
  const top10 = useMemo(
    () =>
      [...personajes]
          .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
          .sort((a, b) => b.elo - a.elo)
          .slice(0, 10),
    [personajes],
  )
  const [vistaIdx, setVistaIdx] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setVistaIdx((v) => (v + 1) % VISTAS.length)
      setTick((t) => t + 1)
    }, DURACION_S * 1000)
    return () => clearInterval(id)
  }, [])

  // Esc para volver a la app normal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && document.exitFullscreen) {
        try {
          document.exitFullscreen()
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const vista = VISTAS[vistaIdx]

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-fg-strong">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-xl sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src="/logo.webp" alt="" className="h-7 w-7 sm:h-10 sm:w-10" />
          <span className="truncate text-base font-extrabold tracking-tight sm:text-2xl">
            AnimeShowdown
          </span>
          <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold sm:ml-2 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-[11px]">
            <Tv className="h-3 w-3" />
            TV
          </span>
        </div>
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg-strong"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Salir</span>
          <span className="hidden sm:inline">(Esc para fullscreen off)</span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-y-auto overflow-x-hidden">
        {/* Aurora fondo decorativa */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/4 h-[40rem] w-[40rem] rounded-full bg-accent opacity-25 blur-3xl animate-aurora-1" />
          <div className="absolute top-1/4 right-1/4 h-[36rem] w-[36rem] rounded-full bg-purple-500 opacity-20 blur-3xl animate-aurora-2" />
        </div>

        <AnimatePresence mode="wait">
          {vista === 'top10' && <VistaTop10 key="top10" top10={top10} />}
          {vista === 'spotlight' && (
            <VistaSpotlight key={`spot-${tick}`} personajes={personajes} tick={tick} />
          )}
          {vista === 'matchup' && (
            <VistaMatchup key={`mu-${tick}`} personajes={personajes} tick={tick} />
          )}
        </AnimatePresence>
      </main>

      <footer className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/40 px-3 py-2 backdrop-blur-xl sm:px-8 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 text-[10px] text-fg-muted sm:text-[11px]">
          <span className="truncate">Rotando cada {DURACION_S}s</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">
            {vistaIdx + 1}/{VISTAS.length}
          </span>
        </div>
        <p className="shrink-0 text-[10px] text-fg-muted sm:text-[11px]">animeshowdown.dev</p>
      </footer>
    </div>
  )
}

function VistaTop10({ top10 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-10 w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-0"
    >
      <div className="mb-4 flex flex-col items-center text-center sm:mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold sm:text-[12px]">
          Top 10 ELO base
        </p>
        <h1 className="mt-2 text-[clamp(1.5rem,6vw,5rem)] font-extrabold leading-none">
          ¿Quién manda hoy?
        </h1>
      </div>
      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        {top10.map((p, i) => (
          <li
            key={p.slug}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md sm:gap-2 sm:p-4"
          >
            <span className="font-mono text-[11px] font-bold text-gold">
              #{i + 1}
            </span>
            <PersonajeImg
              slug={p.slug}
              src={p.imagenUrl ?? p.imagen}
              alt={p.nombre}
              className="h-24 w-20 rounded-lg object-cover object-top sm:h-32 sm:w-24"
            />
            <p className="line-clamp-1 text-center text-[13px] font-bold sm:text-sm">{p.nombre}</p>
            <p className="line-clamp-1 text-center text-[10px] text-fg-muted sm:text-[11px]">
              {p.anime}
            </p>
            <p className="font-mono text-base font-bold text-gold sm:text-lg">{p.elo}</p>
          </li>
        ))}
      </ol>
    </motion.section>
  )
}

function VistaSpotlight({ personajes, tick }) {
  const p = pickRandom(personajes, tick + 7)
  if (!p) return null
  const stats = getStatsPersonaje(p.slug)
  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-10 grid w-full max-w-6xl items-center gap-6 px-4 py-6 sm:gap-12 sm:px-8 sm:py-0 md:grid-cols-2"
    >
      <motion.div
        className="mx-auto aspect-[2/3] w-auto max-h-[40vh] rounded-2xl object-cover object-top sm:rounded-3xl md:max-h-none md:w-full md:max-w-md"
        style={{ filter: 'drop-shadow(0 30px 60px rgb(159 29 44 / 0.38))' }}
      >
        <PersonajeImg
          slug={p.slug}
          src={p.imagenUrl ?? p.imagen}
          alt={p.nombre}
          className="h-full w-full rounded-2xl object-cover object-top sm:rounded-3xl"
        />
      </motion.div>
      <div className="flex flex-col gap-3 sm:gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold sm:text-[12px]">
          Personaje destacado
        </p>
        <h2 className="text-[clamp(1.75rem,6vw,4.5rem)] font-extrabold leading-none">
          {p.nombre}
        </h2>
        <p className="text-base text-fg-muted sm:text-2xl">{p.anime}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          <Kpi label="ELO" value={stats.elo} accent />
          <Kpi label="Victorias" value={stats.wins} />
          <Kpi label="Win rate" value={`${winRate}%`} />
        </div>
        {p.descripcion && (
          <p className="line-clamp-3 text-sm leading-relaxed text-fg-muted sm:text-lg">
            {p.descripcion}
          </p>
        )}
      </div>
    </motion.section>
  )
}

function VistaMatchup({ personajes, tick }) {
  const a = pickRandom(personajes, tick + 1)
  let b = pickRandom(personajes, tick + 100)
  if (!a || !b) return null
  // Garantizamos que no son el mismo (caso raro pero defensivo).
  if (b.slug === a.slug) b = pickRandom(personajes, tick + 200)
  const eloA = getStatsPersonaje(a.slug).elo
  const eloB = getStatsPersonaje(b.slug).elo
  const favorito = eloA > eloB ? a : b
  const diff = Math.abs(eloA - eloB)

  return (
    <motion.section
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-10 w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-0"
    >
      <div className="mb-5 flex flex-col items-center text-center sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold sm:text-[12px]">
          Matchup random
        </p>
        <h2 className="mt-2 text-[clamp(1.5rem,5vw,4rem)] font-extrabold leading-none">
          ¿Quién ganaría?
        </h2>
      </div>
      <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
        <Versus personaje={a} elo={eloA} esFavorito={favorito.slug === a.slug} />
        <span className="order-first col-span-2 text-center font-mono text-3xl font-extrabold text-gold sm:order-none sm:col-span-1 sm:text-5xl">
          VS
        </span>
        <Versus personaje={b} elo={eloB} esFavorito={favorito.slug === b.slug} />
      </div>
      <p className="mt-4 text-center text-[12px] text-fg-muted sm:mt-6 sm:text-base">
        Diferencia ELO: <strong className="text-gold">{diff}</strong>
        {' · '}
        Favorito:{' '}
        <strong className="text-fg-strong">{favorito.nombre}</strong>
      </p>
    </motion.section>
  )
}

function Versus({ personaje, elo, esFavorito }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 backdrop-blur-md sm:gap-3 sm:rounded-2xl sm:p-6 ${
        esFavorito ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <PersonajeImg
        slug={personaje.slug}
        src={personaje.imagenUrl ?? personaje.imagen}
        alt={personaje.nombre}
        className="h-28 w-20 rounded-lg object-cover object-top sm:h-64 sm:w-48"
      />
      <p className="line-clamp-1 text-center text-sm font-bold sm:text-2xl">{personaje.nombre}</p>
      <p className="line-clamp-1 text-center text-[10px] text-fg-muted sm:text-sm">
        {personaje.anime}
      </p>
      <p className="font-mono text-lg font-extrabold text-gold sm:text-2xl">{elo}</p>
    </div>
  )
}

function Kpi({ label, value, accent = false }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 backdrop-blur-md sm:p-3">
      <p className="text-[9px] font-medium uppercase tracking-wider text-fg-muted sm:text-[10px]">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-bold sm:text-2xl ${
          accent ? 'text-gold' : 'text-fg-strong'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default TvModePage
