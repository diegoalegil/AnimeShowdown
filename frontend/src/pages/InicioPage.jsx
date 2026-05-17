import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { webSiteSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  ArrowRight,
  Heart,
  Swords,
  Trophy,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import Hero from '../components/Hero'
import NombresMarquee from '../components/NombresMarquee'
import TorneoCard from '../components/TorneoCard'
import CountUp from '../components/CountUp'
import CarouselRow from '../components/CarouselRow'
import LazyOnView from '../components/LazyOnView'
import { useTorneos } from '../lib/torneosQueries'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import { useSound } from '../contexts/SoundContext'

const totalPersonajes = personajes.length
const animeUniversos = new Set(personajes.map((p) => p.anime)).size
const eloMax = Math.max(
  ...personajes.map((p) => getStatsPersonaje(p.slug).elo),
)

const byAnime = personajes.reduce((acc, p) => {
  if (!acc[p.anime]) acc[p.anime] = []
  acc[p.anime].push(p)
  return acc
}, {})

const carousels = Object.entries(byAnime)
  .filter(([, list]) => list.length >= 4)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5)
  .map(([anime, list]) => ({ anime, list }))

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const top10 = [...personajes]
  .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
  .sort((a, b) => b.elo - a.elo)
  .slice(0, 10)

const pasos = [
  {
    icon: Heart,
    titulo: 'Elige tu lado',
    descripcion:
      'Explora personajes de distintos animes y entra en duelos donde solo uno puede ganar.',
  },
  {
    icon: Swords,
    titulo: 'Vota cara a cara',
    descripcion:
      'Decide quién merece subir. Tus votos afectan el ELO y pueden cambiar la posición de cada personaje.',
  },
  {
    icon: Trophy,
    titulo: 'Corona al campeón',
    descripcion:
      'Sigue los rankings, mira qué personajes dominan y descubre quién se mantiene en la cima.',
  },
]

function InicioPage() {
  // useSeo en la home no setea title (el HTML inicial ya tiene el correcto
  // y queremos preservarlo como canonical); pero sí añadimos canonical
  // explícito y aseguramos OG con la imagen del logo.
  useSeo({
    description:
      'Vota a tus personajes de anime favoritos en torneos cara a cara. Brackets visuales, ranking ELO al instante y predicciones para tu bracket.',
    canonical: 'https://animeshowdown.dev/',
  })
  return (
    <>
      <JsonLd id="website" schema={webSiteSchema()} />
      {/* Jerarquía recomendada: hero → stats → duelo en vivo → top ranking
          → retos diarios → "Hecho para fans" → cómo funciona → torneos
          → explora por universo. Primero entender la propuesta, luego una
          acción clara, luego ranking y el resto a explorar. */}
      <Hero />
      <NombresMarquee />
      <SectionStats />
      <SectionLiveBattle />
      <SectionTop10Ranking />
      {/* Audit (2026-05-17): el resto de secciones eran below-the-fold
          típico — montarlas solo cuando se acercan al viewport recorta
          el initial DOM/JS a ~30%. LazyOnView mantiene el espacio
          reservado para no causar layout shift. */}
      <LazyOnView minHeight={620}><SectionRetosDiarios /></LazyOnView>
      <LazyOnView minHeight={520}><SectionBento /></LazyOnView>
      <LazyOnView minHeight={420}><SectionComoFunciona /></LazyOnView>
      <LazyOnView minHeight={520}><SectionTorneosActivos /></LazyOnView>
      <LazyOnView minHeight={520}><SectionPorAnime /></LazyOnView>
    </>
  )
}

function SectionPorAnime() {
  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
    >
      <div className="mx-auto max-w-7xl px-5 pb-2 pt-12 sm:px-8 sm:pt-16">
        <div className="flex flex-col items-start gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Por anime
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
            Explora por universo
          </h2>
        </div>
      </div>
      {carousels.map(({ anime, list }) => (
        <CarouselRow
          key={anime}
          eyebrow={`${list.length} personajes`}
          titulo={anime}
          personajes={list}
        />
      ))}
    </motion.div>
  )
}

function getRandomPair() {
  const a = Math.floor(Math.random() * personajes.length)
  let b = Math.floor(Math.random() * personajes.length)
  while (b === a) b = Math.floor(Math.random() * personajes.length)
  return [personajes[a], personajes[b]]
}

function SectionLiveBattle() {
  const [pair, setPair] = useState(getRandomPair)

  useEffect(() => {
    const id = setInterval(() => setPair(getRandomPair()), 5000)
    return () => clearInterval(id)
  }, [])

  const [a, b] = pair
  const eloA = getStatsPersonaje(a.slug).elo
  const eloB = getStatsPersonaje(b.slug).elo
  const total = eloA + eloB
  const pctA = Math.round((eloA / total) * 100)
  const pctB = 100 - pctA

  return (
    <motion.section
      className="relative overflow-hidden bg-surface/40 px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                En vivo · Tu voto cambia el ELO
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] tracking-tight">
                Duelo en vivo
              </h2>
              <p className="max-w-xl text-[14px] text-fg-muted">
                Dos personajes. Un voto. Solo uno sube en el ranking. Elige
                quién gana este combate y ayuda a decidir qué personaje merece
                estar más alto en AnimeShowdown.
              </p>
            </div>
          </div>
        </div>
        {/*
          Antes había 2 AnimatePresence (una por slot) con mode="popLayout":
          al cambiar el par cada 5s, cada slot transicionaba independientemente
          y el elemento saliente se ponía position:absolute → el grid se quedaba
          con frames asimétricos donde solo aparecía UNA card grande hasta que
          la otra entraba. Ahora un único AnimatePresence mode="wait" envuelve
          todo el grid: las dos cards salen juntas, esperan a que termine el
          fade-out, y entran juntas. Sin glitch visual.
        */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${a.slug}-vs-${b.slug}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6"
          >
            <BattleSlot personaje={a} pct={pctA} />
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative flex h-16 w-16 items-center justify-center justify-self-center rounded-full border-2 border-accent bg-accent-soft text-accent shadow-[0_0_40px_-10px_rgba(255,46,99,0.6)] sm:h-20 sm:w-20"
            >
              <Swords className="h-6 w-6 sm:h-8 sm:w-8" />
              <span className="absolute -bottom-6 font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent">
                VS
              </span>
            </motion.span>
            <BattleSlot personaje={b} pct={pctB} />
          </motion.div>
        </AnimatePresence>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to="/votar"
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            <Swords className="h-4 w-4" />
            Votar este duelo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="text-[11px] uppercase tracking-[0.15em] text-fg-muted">
            Ranking afectado por cada voto
          </p>
        </div>
      </div>
    </motion.section>
  )
}

function BattleSlot({ personaje, pct }) {
  return (
    <Link
      to="/votar"
      className="group flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-accent/60"
    >
      <img
        src={imagenPersonaje(personaje.slug)}
        alt={personaje.nombre}
        className="aspect-[4/5] w-full object-cover object-top"
      />
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {personaje.nombre}
          </p>
          <p className="truncate text-[11px] text-fg-muted">{personaje.anime}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-alt">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
          <span className="font-mono text-[11px] font-bold text-accent">
            {pct}%
          </span>
        </div>
      </div>
    </Link>
  )
}

function SectionBento() {
  const featuredAvatars = ['luffy', 'naruto', 'satoru_gojo', 'makima']
  const communityAvatars = [
    'mai_sakurajima',
    'satoru_gojo',
    'kuroneko',
    'momo_ayase',
    'shinobu',
    'toru_hagakure',
  ]
  return (
    <motion.section
      className="px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col items-start gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            Plataforma
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] tracking-tight">
            Una competición viva creada por fans
          </h2>
          <p className="max-w-3xl text-[14px] text-fg-muted">
            AnimeShowdown combina duelos rápidos, rankings en vivo y torneos
            visuales para convertir cada voto en parte de una competición
            constante. No se trata solo de elegir personajes — se trata de
            construir, junto a la comunidad, un ranking donde los favoritos
            pueden caer y los tapados pueden sorprender.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BentoCard
            className="md:col-span-2"
            icon={Trophy}
            eyebrow="Brackets"
            titulo="Brackets estilo batalla"
            descripcion="Sigue cada ronda como si fuera un torneo shonen: enfrentamientos directos, favoritos eliminados y campeones que se ganan su puesto voto a voto."
          >
            <div className="flex items-center gap-2">
              {featuredAvatars.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <img
                    src={imagenPersonaje(s)}
                    alt=""
                    className="h-12 w-12 rounded-md border border-border object-cover object-top"
                  />
                  {i < featuredAvatars.length - 1 && (
                    <span className="font-mono text-[11px] font-bold text-accent">
                      vs
                    </span>
                  )}
                </div>
              ))}
            </div>
          </BentoCard>
          <BentoCard
            icon={TrendingUp}
            eyebrow="ELO"
            titulo="Ranking en directo"
            descripcion="Cada voto suma o resta puntos. El ranking se actualiza con los resultados y muestra qué personajes dominan el meta."
          />
          <BentoCard
            icon={User}
            eyebrow="Cuenta"
            titulo="Tu historial, tus votos"
            descripcion="Inicia sesión para guardar tus votos, seguir tus personajes favoritos y construir tu propio recorrido dentro de AnimeShowdown."
          />
          <BentoCard
            className="md:col-span-2"
            icon={Users}
            eyebrow="Comunidad"
            titulo="La comunidad decide"
            descripcion="Cada enfrentamiento recoge la opinión de otros fans y convierte el ranking en una decisión colectiva. Los tapados pueden sorprender."
          >
            <div className="flex -space-x-3">
              {communityAvatars.map((s) => (
                <img
                  key={s}
                  src={imagenPersonaje(s)}
                  alt=""
                  className="h-10 w-10 rounded-full border-2 border-surface object-cover object-top"
                />
              ))}
              <span className="ml-2 inline-flex items-center text-[12px] font-semibold text-fg-muted">
                +90
              </span>
            </div>
          </BentoCard>
        </div>
      </div>
    </motion.section>
  )
}

function BentoCard({
  icon: Icon,
  eyebrow,
  titulo,
  descripcion,
  className = '',
  children,
}) {
  return (
    <div
      className={`group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/40 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </div>
        {eyebrow && (
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            {eyebrow}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-bold text-fg-strong">{titulo}</h3>
        <p className="text-sm leading-relaxed text-fg-muted">{descripcion}</p>
      </div>
      {children && <div className="mt-auto pt-2">{children}</div>}
    </div>
  )
}

function SectionStats() {
  // Si hay torneos del backend mostramos el número. Si no, sustituimos
  // el tile por un "Ranking en vivo" para no transmitir vacío (un "0
  // torneos" hace pensar que la plataforma está incompleta).
  const { data: torneos = [] } = useTorneos()
  const hayTorneos = torneos.length > 0
  return (
    <motion.section
      className="px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-y-8 gap-x-6 sm:grid-cols-4">
          <Stat target={totalPersonajes} label="Personajes" />
          <Stat target={animeUniversos} label="Animes" />
          <Stat target={eloMax} label="ELO máximo" />
          {hayTorneos ? (
            <Stat target={torneos.length} label="Torneos activos" />
          ) : (
            <StatBadge
              label="Ranking en vivo"
              hint="Actualizado con cada voto"
            />
          )}
        </div>
      </div>
    </motion.section>
  )
}

function Stat({ target, label }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-accent/30 pl-4">
      <p className="font-mono text-4xl font-extrabold tracking-tight text-fg-strong tabular-nums sm:text-5xl">
        <CountUp target={target} />
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        {label}
      </p>
    </div>
  )
}

function StatBadge({ label, hint }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-emerald-400/50 pl-4">
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <p className="font-mono text-2xl font-extrabold tracking-tight text-emerald-200 sm:text-3xl">
          {label}
        </p>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        {hint}
      </p>
    </div>
  )
}

function SectionHeader({ eyebrow, titulo, link }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
          {eyebrow}
        </span>
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
          {titulo}
        </h2>
      </div>
      {link && (
        <Link
          to={link.to}
          className="hidden items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent sm:inline-flex"
        >
          {link.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

function SectionTorneosActivos() {
  // Preview de los 3 primeros torneos del backend. Si aún cargan o falla
  // la llamada, la sección se renderiza sin grid (no asusta al usuario
  // con error message — el listado completo está en /torneos).
  const { data: torneos = [] } = useTorneos()
  const torneosPreview = torneos.slice(0, 3)
  if (torneosPreview.length === 0) return null
  return (
    <motion.section
      className="px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Torneos"
          titulo="Brackets en marcha"
          link={{ to: '/torneos', label: 'Ver todos' }}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {torneosPreview.map((t) => (
            <TorneoCard key={t.slug} torneo={t} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function SectionTop10Ranking() {
  return (
    <motion.section
      className="bg-surface/40 px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
                Top 10 · ELO
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] tracking-tight">
                Los más fuertes del ranking ELO
              </h2>
              <p className="max-w-2xl text-[14px] text-fg-muted">
                Estos son los personajes que la comunidad ha llevado a la cima.
                Cada victoria suma puntos, cada derrota puede cambiarlo todo.
              </p>
            </div>
            <Link
              to="/ranking"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/20"
            >
              Ver ranking completo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        <ol className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
          {top10.map((p, i) => (
            <Top10Card key={p.slug} rank={i + 1} {...p} />
          ))}
        </ol>
      </div>
    </motion.section>
  )
}

function Top10Card({ rank, slug, nombre, anime, elo }) {
  const { play } = useSound()
  return (
    <li className="flex-none snap-start">
      <Link
        to={`/personajes/${slug}`}
        onClick={() => play('playWhoosh')}
        className="group flex items-end gap-0"
      >
        <span
          aria-hidden="true"
          className="select-none font-extrabold leading-[0.85] tracking-tighter text-[120px] sm:text-[160px]"
          style={{
            WebkitTextStroke: '2px var(--color-accent)',
            color: 'transparent',
            marginRight: rank === 10 ? '-30px' : '-20px',
          }}
        >
          {rank}
        </span>
        <div className="relative z-10 flex w-[140px] flex-col gap-1 sm:w-[160px]">
          <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface transition-all group-hover:-translate-y-1 group-hover:border-accent/40">
            <img
              src={imagenPersonaje(slug)}
              alt={nombre}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-fg-strong group-hover:text-accent">
                {nombre}
              </p>
              <p className="truncate text-[11px] text-fg-muted">{anime}</p>
            </div>
            <p className="shrink-0 font-mono text-[12px] font-bold text-accent">
              {elo}
            </p>
          </div>
        </div>
      </Link>
    </li>
  )
}

const RETOS_DIARIOS = [
  {
    to: '/games/shadow-guess',
    kanji: '影',
    titulo: 'Shadow Guess',
    desc: 'Silueta borrosa · 5 intentos',
    color: 'rose',
  },
  {
    to: '/games/anime-reveal',
    kanji: '謎',
    titulo: 'Anime Reveal',
    desc: 'Adivina el anime · con pistas',
    color: 'amber',
  },
  {
    to: '/games/anigrid',
    kanji: '格',
    titulo: 'AniGrid',
    desc: 'Wordle de personajes · 6 intentos',
    color: 'emerald',
  },
  {
    to: '/games/impostor-trial',
    kanji: '裏',
    titulo: 'Impostor Trial',
    desc: '4 cartas · 1 traidor',
    color: 'purple',
  },
  {
    to: '/games/elo-duel',
    kanji: '戦',
    titulo: 'ELO Duel',
    desc: 'Higher or Lower · endless',
    color: 'cyan',
  },
]

const RETO_COLORS = {
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
  cyan: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
}

function SectionRetosDiarios() {
  return (
    <motion.section
      className="bg-surface/30 px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
                御 · Anime Daily Trials
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] tracking-tight">
                Retos diarios de anime
              </h2>
              <p className="max-w-2xl text-[14px] text-fg-muted">
                Pon a prueba tu memoria otaku con modos rápidos: adivina
                personajes, detecta impostores y protege tu racha diaria.
              </p>
            </div>
            <Link
              to="/games"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/20"
            >
              Jugar retos diarios
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {RETOS_DIARIOS.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={`group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-surface p-4 transition-all hover:-translate-y-1 ${RETO_COLORS[r.color]}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -right-3 -top-5 select-none font-mono text-[5rem] leading-none opacity-[0.1] ${RETO_COLORS[r.color].split(' ').find((c) => c.startsWith('text-'))}`}
              >
                {r.kanji}
              </span>
              <div
                className={`relative flex h-12 w-12 items-center justify-center rounded-lg border-2 ${RETO_COLORS[r.color]}`}
              >
                <span className="font-mono text-2xl font-extrabold">
                  {r.kanji}
                </span>
              </div>
              <h3 className="relative text-sm font-bold text-fg-strong group-hover:text-accent">
                {r.titulo}
              </h3>
              <p className="relative text-[11px] text-fg-muted">{r.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function SectionComoFunciona() {
  return (
    <motion.section
      className="bg-dots px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col items-start gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            Cómo funciona
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] tracking-tight">
            Tres pasos para coronar al campeón
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {pasos.map((paso, i) => (
            <PasoCard key={paso.titulo} numero={i + 1} {...paso} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function PasoCard({ numero, icon: Icon, titulo, descripcion }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/40">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-mono text-[12px] font-semibold text-fg-muted">
          0{numero}
        </span>
      </div>
      <h3 className="text-lg font-bold text-fg-strong">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {descripcion}
      </p>
    </div>
  )
}

export default InicioPage
