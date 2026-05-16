import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Tv } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'

/**
 * TV Mode (Plan v2 §11.3) — vista pantalla completa sin chrome de la
 * SPA. Pensada para streamers que quieren mostrar AnimeShowdown en su
 * stream, museos digitales, pantallas de eventos, etc.
 *
 * <p>Auto-rotación cada 10s entre 3 vistas: Top ELO, personaje aleatorio
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

const top10 = (() => {
  return [...personajes]
      .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 10)
})()

function pickRandom(arr, seed) {
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
      <header className="flex items-center justify-between border-b border-white/10 bg-black/40 px-8 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src="/logo.webp" alt="" className="h-10 w-10" />
          <span className="text-2xl font-extrabold tracking-tight">
            AnimeShowdown
          </span>
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <Tv className="h-3 w-3" />
            TV Mode
          </span>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg-strong"
        >
          <ArrowLeft className="h-3 w-3" />
          Salir (Esc para fullscreen off)
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Aurora fondo decorativa */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/4 h-[40rem] w-[40rem] rounded-full bg-accent opacity-25 blur-3xl animate-aurora-1" />
          <div className="absolute top-1/4 right-1/4 h-[36rem] w-[36rem] rounded-full bg-purple-500 opacity-20 blur-3xl animate-aurora-2" />
        </div>

        <AnimatePresence mode="wait">
          {vista === 'top10' && <VistaTop10 key="top10" />}
          {vista === 'spotlight' && <VistaSpotlight key={`spot-${tick}`} tick={tick} />}
          {vista === 'matchup' && <VistaMatchup key={`mu-${tick}`} tick={tick} />}
        </AnimatePresence>
      </main>

      <footer className="flex items-center justify-between border-t border-white/10 bg-black/40 px-8 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[11px] text-fg-muted">
          <span>Rotando cada {DURACION_S}s</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">
            {vistaIdx + 1}/{VISTAS.length}
          </span>
        </div>
        <p className="text-[11px] text-fg-muted">animeshowdown.dev</p>
      </footer>
    </div>
  )
}

function VistaTop10() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-10 w-full max-w-7xl px-8"
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-accent">
          Top 10 ELO global
        </p>
        <h2 className="mt-2 text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-none">
          ¿Quién manda hoy?
        </h2>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {top10.map((p, i) => (
          <li
            key={p.slug}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
          >
            <span className="font-mono text-[11px] font-bold text-accent">
              #{i + 1}
            </span>
            <img
              src={imagenPersonaje(p.slug)}
              alt=""
              className="h-32 w-24 rounded-lg object-cover object-top"
            />
            <p className="line-clamp-1 text-center text-sm font-bold">{p.nombre}</p>
            <p className="line-clamp-1 text-center text-[11px] text-fg-muted">
              {p.anime}
            </p>
            <p className="font-mono text-lg font-bold text-accent">{p.elo}</p>
          </li>
        ))}
      </ol>
    </motion.section>
  )
}

function VistaSpotlight({ tick }) {
  const p = pickRandom(personajes, tick + 7)
  const stats = getStatsPersonaje(p.slug)
  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative z-10 grid w-full max-w-6xl items-center gap-12 px-8 md:grid-cols-2"
    >
      <motion.img
        src={imagenPersonaje(p.slug)}
        alt={p.nombre}
        className="aspect-[2/3] w-full max-w-md rounded-3xl object-cover object-top"
        style={{ filter: 'drop-shadow(0 30px 60px rgb(255 46 99 / 0.4))' }}
      />
      <div className="flex flex-col gap-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-accent">
          Personaje destacado
        </p>
        <h2 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-none">
          {p.nombre}
        </h2>
        <p className="text-2xl text-fg-muted">{p.anime}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Kpi label="ELO" value={stats.elo} accent />
          <Kpi label="Victorias" value={stats.wins} />
          <Kpi label="Win rate" value={`${winRate}%`} />
        </div>
        {p.descripcion && (
          <p className="line-clamp-3 text-lg leading-relaxed text-fg-muted">
            {p.descripcion}
          </p>
        )}
      </div>
    </motion.section>
  )
}

function VistaMatchup({ tick }) {
  const a = pickRandom(personajes, tick + 1)
  let b = pickRandom(personajes, tick + 100)
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
      className="relative z-10 w-full max-w-6xl px-8"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-accent">
          Matchup random
        </p>
        <h2 className="mt-2 text-[clamp(2rem,5vw,4rem)] font-extrabold leading-none">
          ¿Quién ganaría?
        </h2>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <Versus personaje={a} elo={eloA} esFavorito={favorito.slug === a.slug} />
        <span className="font-mono text-5xl font-extrabold text-accent">VS</span>
        <Versus personaje={b} elo={eloB} esFavorito={favorito.slug === b.slug} />
      </div>
      <p className="mt-6 text-center text-fg-muted">
        Diferencia ELO: <strong className="text-accent">{diff}</strong>
        {' · '}
        Favorito según el ranking:{' '}
        <strong className="text-fg-strong">{favorito.nombre}</strong>
      </p>
    </motion.section>
  )
}

function Versus({ personaje, elo, esFavorito }) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 backdrop-blur-md ${
        esFavorito ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <img
        src={imagenPersonaje(personaje.slug)}
        alt=""
        className="h-48 w-36 rounded-lg object-cover object-top sm:h-64 sm:w-48"
      />
      <p className="text-center text-xl font-bold sm:text-2xl">{personaje.nombre}</p>
      <p className="text-center text-[12px] text-fg-muted sm:text-sm">
        {personaje.anime}
      </p>
      <p className="font-mono text-2xl font-extrabold text-accent">{elo}</p>
    </div>
  )
}

function Kpi({ label, value, accent = false }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-md">
      <p className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-bold ${
          accent ? 'text-accent' : 'text-fg-strong'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default TvModePage
