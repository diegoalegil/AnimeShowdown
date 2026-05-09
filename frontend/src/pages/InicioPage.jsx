import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
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
import { torneos } from '../data/torneos'
import {
  personajes,
  imagenPersonaje,
  getStatsPersonaje,
} from '../data/personajes'

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

const torneosPreview = torneos.slice(0, 3)

const pasos = [
  {
    icon: Heart,
    titulo: 'Elige tu lado',
    descripcion:
      'Explora 96 personajes de tus animes favoritos y descubre quién compite en cada torneo.',
  },
  {
    icon: Swords,
    titulo: 'Vota cara a cara',
    descripcion:
      'Decide quién gana cada enfrentamiento. Tus votos suman puntos al ELO de cada personaje.',
  },
  {
    icon: Trophy,
    titulo: 'Corona al campeón',
    descripcion:
      'Sigue el bracket en directo y celebra al ganador del torneo. Los rankings se actualizan en cada ronda.',
  },
]

function InicioPage() {
  return (
    <>
      <Hero />
      <NombresMarquee />
      <SectionStats />
      <SectionLiveBattle />
      <SectionTorneosActivos />
      <SectionPorAnime />
      <SectionTop10Ranking />
      <SectionBento />
      <SectionComoFunciona />
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
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              En vivo
            </span>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
              Enfrentamiento ahora
            </h2>
          </div>
          <Link
            to="/votar"
            className="hidden items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent sm:inline-flex"
          >
            Vota tú
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <AnimatePresence mode="popLayout">
            <BattleSlot
              key={`a-${a.slug}`}
              personaje={a}
              pct={pctA}
              side="left"
            />
          </AnimatePresence>
          <span className="flex h-12 w-12 items-center justify-center justify-self-center rounded-full border border-accent/40 bg-accent-soft text-accent">
            <Swords className="h-5 w-5" />
          </span>
          <AnimatePresence mode="popLayout">
            <BattleSlot
              key={`b-${b.slug}`}
              personaje={b}
              pct={pctB}
              side="right"
            />
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  )
}

function BattleSlot({ personaje, pct, side }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === 'left' ? 30 : -30 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface"
    >
      <img
        src={imagenPersonaje(personaje.slug)}
        alt={personaje.nombre}
        className="aspect-[4/5] w-full object-cover object-top"
      />
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg-strong">
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
    </motion.div>
  )
}

function SectionBento() {
  const featuredAvatars = ['luffy', 'naruto', 'gojo', 'makima']
  const communityAvatars = [
    'mai_sakurajima',
    'gojo',
    'kuroneko',
    'momo',
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
        <div className="mb-10 flex flex-col items-start gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Plataforma
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
            Hecho para fans del anime
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BentoCard
            className="md:col-span-2"
            icon={Trophy}
            eyebrow="Brackets"
            titulo="Visualización de torneos"
            descripcion="Sigue el avance de cada bracket round a round, con avatares grandes y resultados de cada enfrentamiento sin recargar."
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
            descripcion="Cada voto suma o resta puntos a los duelistas. El top 5 se actualiza tras cada ronda."
          />
          <BentoCard
            icon={User}
            eyebrow="Cuenta"
            titulo="Tu historial, tu equipo"
            descripcion="Inicia sesión para guardar torneos creados, votos emitidos y tu pódium personal de mejores personajes."
          />
          <BentoCard
            className="md:col-span-2"
            icon={Users}
            eyebrow="Comunidad"
            titulo="Vota con miles de fans"
            descripcion="No estás solo. Cada enfrentamiento agrega votos de toda la comunidad y los rankings reflejan el consenso."
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
          <Stat target={personajes.length} label="Personajes" />
          <Stat target={torneos.length} label="Torneos" />
          <Stat target={animeUniversos} label="Animes" />
          <Stat target={eloMax} label="ELO máximo" />
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
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
              Top 10
            </span>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
              Más alto ranking ELO
            </h2>
          </div>
          <Link
            to="/ranking"
            className="hidden items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-accent sm:inline-flex"
          >
            Ver los 96
            <ArrowRight className="h-4 w-4" />
          </Link>
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
  return (
    <li className="flex-none snap-start">
      <Link
        to={`/personajes/${slug}`}
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
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            Cómo funciona
          </span>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight">
            Tres pasos para coronar al mejor
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
