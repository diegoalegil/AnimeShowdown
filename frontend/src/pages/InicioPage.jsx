import { motion } from 'framer-motion'
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

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const top5 = [...personajes]
  .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
  .sort((a, b) => b.elo - a.elo)
  .slice(0, 5)

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
      <SectionTorneosActivos />
      <SectionTop5Ranking />
      <SectionBento />
      <SectionComoFunciona />
    </>
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

function SectionTop5Ranking() {
  return (
    <motion.section
      className="bg-surface/40 px-5 py-16 sm:px-8 sm:py-20"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="Ranking"
          titulo="Top 5 por ELO"
          link={{ to: '/ranking', label: 'Ver completo' }}
        />
        <ol className="flex flex-col gap-2">
          {top5.map((p, i) => (
            <Top5Row key={p.slug} rank={i + 1} {...p} />
          ))}
        </ol>
      </div>
    </motion.section>
  )
}

function Top5Row({ rank, slug, nombre, anime, elo }) {
  return (
    <li>
      <Link
        to={`/personajes/${slug}`}
        className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-all hover:-translate-x-1 hover:border-accent/40"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${
            rank === 1
              ? 'bg-yellow-500/15 text-yellow-400'
              : rank === 2
                ? 'bg-zinc-400/15 text-zinc-300'
                : rank === 3
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'bg-surface-alt text-fg-muted'
          }`}
        >
          {rank === 1 ? <Trophy className="h-5 w-5" /> : rank}
        </span>
        <img
          src={imagenPersonaje(slug)}
          alt=""
          className="h-12 w-9 shrink-0 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-strong group-hover:text-accent">
            {nombre}
          </p>
          <p className="truncate text-[12px] text-fg-muted">{anime}</p>
        </div>
        <p className="font-mono text-base font-bold text-accent">{elo}</p>
      </Link>
    </li>
  )
}

function SectionComoFunciona() {
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
