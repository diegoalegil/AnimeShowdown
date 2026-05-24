import { useMemo } from 'react'
import { motion } from 'framer-motion'
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
import SectionPulso from '../components/SectionPulso'
import TorneoCard from '../components/TorneoCard'
import CountUp from '../components/CountUp'
import CarouselRow from '../components/CarouselRow'
import LazyOnView from '../components/LazyOnView'
import DailyMissionPanel from '../components/DailyMissionPanel'
import { useTorneos } from '../lib/torneosQueries'
import { getStatsPersonaje } from '../lib/personajes-core'
import PersonajeImg from '../components/PersonajeImg'
import { useSound } from '../contexts/SoundContext'
import { getGameVisual } from '../data/visual-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'

function getHomeStats(catalogoPersonajes) {
  if (catalogoPersonajes.length === 0) {
    return { totalPersonajes: 0, animeUniversos: 0, eloMax: 0 }
  }
  return {
    totalPersonajes: catalogoPersonajes.length,
    animeUniversos: new Set(catalogoPersonajes.map((p) => p.anime)).size,
    eloMax: Math.max(
      ...catalogoPersonajes.map((p) => getStatsPersonaje(p.slug).elo),
    ),
  }
}

function getHomeCarousels(catalogoPersonajes) {
  const byAnime = catalogoPersonajes.reduce((acc, p) => {
    if (!acc[p.anime]) acc[p.anime] = []
    acc[p.anime].push(p)
    return acc
  }, {})

  return Object.entries(byAnime)
    .filter(([, list]) => list.length >= 4)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([anime, list]) => ({ anime, list }))
}

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

function getHomeTop10(catalogoPersonajes) {
  return [...catalogoPersonajes]
    .map((p) => ({ ...p, ...getStatsPersonaje(p.slug) }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 10)
}

const pasos = [
  {
    icon: Heart,
    titulo: 'Elige tu lado',
    descripcion:
      'Explora personajes de distintos animes y entra en duelos donde solo uno puede ganar.',
    tone: 'rose',
    kanji: '撰',
  },
  {
    icon: Swords,
    titulo: 'Vota cara a cara',
    descripcion:
      'Decide quién merece subir. Tus votos afectan el ELO y pueden cambiar la posición de cada personaje.',
    tone: 'cyan',
    kanji: '闘',
  },
  {
    icon: Trophy,
    titulo: 'Corona al campeón',
    descripcion:
      'Sigue los rankings, mira qué personajes dominan y descubre quién se mantiene en la cima.',
    tone: 'gold',
    kanji: '冠',
  },
]

function InicioPage() {
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const stats = useMemo(
    () => getHomeStats(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const carousels = useMemo(
    () => getHomeCarousels(catalogoPersonajes),
    [catalogoPersonajes],
  )
  const top10 = useMemo(
    () => getHomeTop10(catalogoPersonajes),
    [catalogoPersonajes],
  )
  // useSeo en la home no setea title (el HTML inicial ya tiene el correcto
  // y queremos preservarlo como canonical); pero sí añadimos canonical
  // explícito y aseguramos OG con la imagen del logo.
  useSeo({
    description:
      '1052 personajes, ranking ELO en directo y brackets visuales. Vota a tus favoritos y mueve el ranking cada semana.',
    canonical: 'https://animeshowdown.dev/',
  })
  return (
    <>
      <JsonLd id="website" schema={webSiteSchema()} />
      {/* Jerarquía recomendada: hero → stats → duelo en vivo → top ranking
          → retos diarios → "Hecho para fans" → cómo funciona → torneos
          → explora por universo. Primero entender la propuesta, luego una
          acción clara, luego ranking y el resto a explorar. */}
      <Hero catalogoPersonajes={catalogoPersonajes} />
      <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <DailyMissionPanel />
      </section>
      {/* Nota de producto: Pulso sustituye al antiguo
          SectionLiveBattle (duelo random cliente-side, no era "live").
          Cinco señales reales desde backend arriba del fold para que
          la home muestre producto en marcha, no solo feature list. */}
      <SectionPulso />
      <NombresMarquee />
      <SectionStats stats={stats} />
      <SectionTop10Ranking top10={top10} />
      {/* el resto de secciones eran below-the-fold
          típico — montarlas solo cuando se acercan al viewport recorta
          el initial DOM/JS a ~30%. LazyOnView mantiene el espacio
          reservado para no causar layout shift. */}
      <LazyOnView minHeight={620}><SectionRetosDiarios /></LazyOnView>
      <LazyOnView minHeight={520}><SectionBento /></LazyOnView>
      <LazyOnView minHeight={420}><SectionComoFunciona /></LazyOnView>
      <LazyOnView minHeight={520}><SectionTorneosActivos /></LazyOnView>
      <LazyOnView minHeight={520}><SectionPorAnime carousels={carousels} /></LazyOnView>
    </>
  )
}

function SectionPorAnime({ carousels }) {
  if (carousels.length === 0) return null

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
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
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
            tone="gold"
            kanji="戦"
            titulo="Brackets estilo batalla"
            descripcion="Sigue cada ronda como si fuera un torneo shonen: enfrentamientos directos, favoritos eliminados y campeones que se ganan su puesto voto a voto."
          >
            <div className="flex items-center gap-2">
              {featuredAvatars.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <PersonajeImg
                    slug={s}
                    alt=""
                    sizes="48px"
                    className="h-12 w-12 rounded-md border border-border object-cover object-top"
                  />
                  {i < featuredAvatars.length - 1 && (
                    <span className="font-mono text-xs font-bold text-gold">
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
            tone="crimson"
            kanji="冠"
            titulo="Ranking en directo"
            descripcion="Cada voto suma o resta puntos. El ranking se actualiza con los resultados y muestra qué personajes dominan el meta."
          />
          <BentoCard
            icon={User}
            eyebrow="Cuenta"
            tone="violet"
            kanji="私"
            titulo="Tu historial, tus votos"
            descripcion="Inicia sesión para guardar tus votos, seguir tus personajes favoritos y construir tu propio recorrido dentro de AnimeShowdown."
          />
          <BentoCard
            className="md:col-span-2"
            icon={Users}
            eyebrow="Comunidad"
            tone="cyan"
            kanji="衆"
            titulo="La comunidad decide"
            descripcion="Cada enfrentamiento recoge la opinión de otros fans y convierte el ranking en una decisión colectiva. Los tapados pueden sorprender."
          >
            <div className="flex -space-x-3">
              {communityAvatars.map((s) => (
                <PersonajeImg
                  key={s}
                  slug={s}
                  alt=""
                  sizes="40px"
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

// Paletas por tone para BentoCard: cada feature tiene SU color en lugar
// del rojo accent monotono que daba look "landing SaaS". El glow del
// hover, el icon halo y el eyebrow border heredan el mismo tone.
const BENTO_TONES = {
  gold: {
    eyebrow: 'border-amber-500/45 bg-amber-500/12 text-amber-200',
    iconRing: 'border-amber-500/45 bg-amber-500/10 text-amber-300',
    iconGlow: '0 0 28px -4px rgba(245,158,11,0.55)',
    titleHover: 'group-hover:text-amber-200',
    hover: 'hover:border-amber-500/55 hover:shadow-[0_20px_60px_-30px_rgba(245,158,11,0.55)]',
    kanji: 'text-amber-300',
    kanjiShadow: '0 0 70px rgba(245,158,11,0.40)',
  },
  crimson: {
    eyebrow: 'border-rose-500/45 bg-rose-500/12 text-rose-200',
    iconRing: 'border-rose-500/45 bg-rose-500/10 text-rose-300',
    iconGlow: '0 0 28px -4px rgba(244,63,94,0.55)',
    titleHover: 'group-hover:text-rose-200',
    hover: 'hover:border-rose-500/55 hover:shadow-[0_20px_60px_-30px_rgba(244,63,94,0.55)]',
    kanji: 'text-rose-300',
    kanjiShadow: '0 0 70px rgba(244,63,94,0.40)',
  },
  violet: {
    eyebrow: 'border-violet-500/45 bg-violet-500/12 text-violet-200',
    iconRing: 'border-violet-500/45 bg-violet-500/10 text-violet-300',
    iconGlow: '0 0 28px -4px rgba(139,92,246,0.55)',
    titleHover: 'group-hover:text-violet-200',
    hover: 'hover:border-violet-500/55 hover:shadow-[0_20px_60px_-30px_rgba(139,92,246,0.55)]',
    kanji: 'text-violet-300',
    kanjiShadow: '0 0 70px rgba(139,92,246,0.40)',
  },
  cyan: {
    eyebrow: 'border-cyan-500/45 bg-cyan-500/12 text-cyan-200',
    iconRing: 'border-cyan-500/45 bg-cyan-500/10 text-cyan-300',
    iconGlow: '0 0 28px -4px rgba(6,182,212,0.55)',
    titleHover: 'group-hover:text-cyan-200',
    hover: 'hover:border-cyan-500/55 hover:shadow-[0_20px_60px_-30px_rgba(6,182,212,0.55)]',
    kanji: 'text-cyan-300',
    kanjiShadow: '0 0 70px rgba(6,182,212,0.40)',
  },
}

function BentoCard({
  icon: Icon,
  eyebrow,
  titulo,
  descripcion,
  className = '',
  children,
  tone = 'crimson',
  kanji,
}) {
  const t = BENTO_TONES[tone] ?? BENTO_TONES.crimson
  return (
    <div
      className={`group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/8 bg-surface/85 p-6 backdrop-blur-md transition-all duration-300 ${t.hover} ${className}`}
    >
      {/* Kanji decorativo de background por card */}
      {kanji && (
        <span
          aria-hidden="true"
          lang="ja"
          className={`pointer-events-none absolute -right-4 -top-8 select-none font-mono text-[7rem] font-black leading-none opacity-[0.07] sm:text-[9rem] sm:opacity-[0.10] ${t.kanji}`}
          style={{ textShadow: t.kanjiShadow }}
        >
          {kanji}
        </span>
      )}
      <div className="relative flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl border ${t.iconRing}`}
          style={{ boxShadow: t.iconGlow }}
        >
          <Icon className="h-5 w-5" />
        </div>
        {eyebrow && (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${t.eyebrow}`}
          >
            {eyebrow}
          </span>
        )}
      </div>
      <div className="relative flex flex-col gap-2">
        <h3 className={`text-xl font-bold text-fg-strong transition-colors ${t.titleHover}`}>
          {titulo}
        </h3>
        <p className="text-sm leading-relaxed text-fg-muted">{descripcion}</p>
      </div>
      {children && <div className="relative mt-auto pt-2">{children}</div>}
    </div>
  )
}

function SectionStats({ stats }) {
  // Si hay torneos del backend mostramos el número. Si no, sustituimos
  // el tile por un "Ranking en vivo" para no transmitir vacío (un "0
  // torneos" hace pensar que la plataforma está incompleta).
  const { data: torneos = [] } = useTorneos()
  if (stats.totalPersonajes === 0) return null

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
          <Stat target={stats.totalPersonajes} label="Personajes" />
          <Stat target={stats.animeUniversos} label="Animes" />
          <Stat target={stats.eloMax} label="ELO máximo" />
          {hayTorneos ? (
            <Stat target={torneos.length} label="Torneos visibles" />
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
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-muted">
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
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-muted">
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
          className="hidden items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-gold sm:inline-flex"
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

function SectionTop10Ranking({ top10 }) {
  if (top10.length === 0) return null

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
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
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
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:bg-accent/20 hover:text-gold"
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
  const highPriorityImage = rank <= 4
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
            <PersonajeImg
              slug={slug}
              alt={nombre}
              loading={highPriorityImage ? 'eager' : 'lazy'}
              fetchPriority={highPriorityImage ? 'high' : 'auto'}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-fg-strong group-hover:text-gold">
                {nombre}
              </p>
              <p className="truncate text-xs text-fg-muted">{anime}</p>
            </div>
            <p className="shrink-0 font-mono text-[12px] font-bold text-elo-number tabular-nums">
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
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
                <span lang="ja">御</span> · Anime Daily Trials
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
              className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:bg-accent/20 hover:text-gold"
            >
              Jugar retos diarios
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        {/* Layout 1/2/3 cols con cover real de cada juego, altura estable y
            overlay inferior para legibilidad. El kanji decorativo respira
            sobre la imagen. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RETOS_DIARIOS.map((r) => {
            const colorClasses = RETO_COLORS[r.color]
            const textColor =
              colorClasses?.split(' ').find((c) => c.startsWith('text-')) || ''
            const visual = getGameVisual(r.to, r.titulo)
            const coverImage = visual?.image || visual?.fallbackImage
            return (
              <Link
                key={r.to}
                to={r.to}
                className={`group relative flex min-h-[13rem] flex-col gap-2 overflow-hidden rounded-xl border bg-surface/85 p-5 transition-all duration-300 hover:-translate-y-1.5 hover:bg-surface hover:shadow-[0_22px_70px_-22px_rgba(159,29,44,0.65)] backdrop-blur-sm sm:min-h-[14rem] ${colorClasses}`}
              >
                {coverImage && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center opacity-55 transition-transform duration-700 group-hover:scale-[1.04]"
                    style={{ backgroundImage: `url("${coverImage}")` }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
                />
                <span
                  aria-hidden="true"
                  lang="ja"
                  className={`pointer-events-none absolute -right-3 -top-5 select-none font-mono text-[6rem] leading-none opacity-[0.18] transition-all duration-500 group-hover:opacity-[0.30] group-hover:-translate-y-1 ${textColor}`}
                  style={{ textShadow: '0 0 45px currentColor' }}
                >
                  {r.kanji}
                </span>
                <div
                  className={`relative z-10 mt-auto flex h-12 w-12 items-center justify-center rounded-lg border-2 backdrop-blur transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_28px_-6px_currentColor] ${colorClasses}`}
                >
                  <span lang="ja" className="font-mono text-2xl font-extrabold">
                    {r.kanji}
                  </span>
                </div>
                <h3 className="relative z-10 text-base font-bold text-fg-strong drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] transition-colors group-hover:text-gold sm:text-lg">
                  {r.titulo}
                </h3>
                <p className="relative z-10 text-xs text-fg-muted drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-[13px]">
                  {r.desc}
                </p>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-4 bottom-2 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-accent/60 to-transparent transition-transform duration-300 group-hover:scale-x-100"
                />
              </Link>
            )
          })}
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
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-gold">
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

const PASO_TONES = {
  rose: {
    border: 'border-rose-500/35',
    hoverBorder: 'hover:border-rose-500/55',
    iconRing: 'border-rose-500/45 bg-rose-500/10 text-rose-300',
    iconGlow: '0 0 28px -6px rgba(244,63,94,0.55)',
    hoverShadow: 'hover:shadow-[0_20px_60px_-30px_rgba(244,63,94,0.50)]',
    titleHover: 'group-hover:text-rose-200',
    kanji: 'text-rose-300',
    kanjiShadow: '0 0 70px rgba(244,63,94,0.40)',
    number: 'text-rose-300/70',
  },
  cyan: {
    border: 'border-cyan-500/35',
    hoverBorder: 'hover:border-cyan-500/55',
    iconRing: 'border-cyan-500/45 bg-cyan-500/10 text-cyan-300',
    iconGlow: '0 0 28px -6px rgba(6,182,212,0.55)',
    hoverShadow: 'hover:shadow-[0_20px_60px_-30px_rgba(6,182,212,0.50)]',
    titleHover: 'group-hover:text-cyan-200',
    kanji: 'text-cyan-300',
    kanjiShadow: '0 0 70px rgba(6,182,212,0.40)',
    number: 'text-cyan-300/70',
  },
  gold: {
    border: 'border-amber-500/35',
    hoverBorder: 'hover:border-amber-500/55',
    iconRing: 'border-amber-500/45 bg-amber-500/10 text-amber-300',
    iconGlow: '0 0 28px -6px rgba(245,158,11,0.55)',
    hoverShadow: 'hover:shadow-[0_20px_60px_-30px_rgba(245,158,11,0.50)]',
    titleHover: 'group-hover:text-amber-200',
    kanji: 'text-amber-300',
    kanjiShadow: '0 0 70px rgba(245,158,11,0.40)',
    number: 'text-amber-300/70',
  },
}

function PasoCard({ numero, icon: Icon, titulo, descripcion, tone = 'rose', kanji }) {
  const t = PASO_TONES[tone] ?? PASO_TONES.rose
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border ${t.border} bg-surface/85 p-6 backdrop-blur-md transition-all duration-300 ${t.hoverBorder} ${t.hoverShadow}`}
    >
      {kanji && (
        <span
          aria-hidden="true"
          lang="ja"
          className={`pointer-events-none absolute -right-4 -top-8 select-none font-mono text-[7rem] font-black leading-none opacity-[0.08] sm:text-[9rem] sm:opacity-[0.12] ${t.kanji}`}
          style={{ textShadow: t.kanjiShadow }}
        >
          {kanji}
        </span>
      )}
      <div className="relative mb-4 flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl border ${t.iconRing}`}
          style={{ boxShadow: t.iconGlow }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className={`font-mono text-[28px] font-black tabular-nums leading-none ${t.number}`}>
          0{numero}
        </span>
      </div>
      <h3 className={`relative text-lg font-bold text-fg-strong transition-colors ${t.titleHover}`}>
        {titulo}
      </h3>
      <p className="relative mt-2 text-sm leading-relaxed text-fg-muted">
        {descripcion}
      </p>
    </div>
  )
}

export default InicioPage
