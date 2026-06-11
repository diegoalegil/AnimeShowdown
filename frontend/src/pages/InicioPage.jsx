import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { webSiteSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  AlertTriangle,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import Hero from '../components/Hero'
import SectionCombateEstelar from '../components/SectionCombateEstelar'
import SectionPulso from '../components/SectionPulso'
import TorneoCard from '../components/TorneoCard'
import CarouselRow from '../components/CarouselRow'
import LazyOnView from '../components/LazyOnView'
import DailyMissionPanel from '../components/DailyMissionPanel'
import SobreBienvenidaBanner from '../features/cartas/SobreBienvenidaBanner'
import Button from '../components/Button'
import Card from '../components/Card'
import Section from '../components/Section'
import EmptyState from '../components/EmptyState'
import ErrorBoundary from '../components/ErrorBoundary'
import { HomeSkeleton } from '../components/PageSkeleton'
import { useTorneos } from '../lib/torneosQueries'
import { getStatsPersonaje } from '../lib/personajes-core'
import PersonajeImg from '../components/PersonajeImg'
import { useSound } from '../contexts/SoundContext'
import { getGameVisual } from '../data/visual-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'

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

function InicioPage() {
  const {
    personajes: catalogoPersonajes,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    refetch: refetchCatalogo,
  } = usePersonajesCatalogo()
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
      'Más de 1000 personajes, ranking ELO en directo y brackets visuales. Vota a tus favoritos y mueve el ranking cada semana.',
    canonical: 'https://animeshowdown.dev/',
  })
  return (
    <>
      <JsonLd id="website" schema={webSiteSchema()} />
      {/* Jerarquía de la portada: hero → combate estelar (cartel del día)
          → pulso + misión diaria → top ranking → retos diarios → torneos
          → explora por universo. Primero entender la propuesta, luego una
          acción clara, luego ranking y el resto a explorar. */}
      <Hero catalogoPersonajes={catalogoPersonajes} />
      <SobreBienvenidaBanner />
      <HomeCatalogGuard
        isLoading={isCatalogLoading}
        isError={isCatalogError}
        hasItems={catalogoPersonajes.length > 0}
        onRetry={refetchCatalogo}
      >
      {/* Combate estelar: el cartel del duelo del día justo tras el hero.
          LazyOnView lo saca del primer paint (el hero sigue siendo el LCP).
          minHeight = altura real medida de la sección (961px @390px de
          viewport, 1086px @1440px; se reserva la menor redondeada a decenas
          para no sobre-reservar en móvil). */}
      <LazyOnView minHeight={960}>
        <HomeSectionBoundary title="No pudimos mostrar el combate estelar">
          <SectionCombateEstelar />
        </HomeSectionBoundary>
      </LazyOnView>
      {/* Bloque "en vivo" (F2): el Pulso (cinco señales reales del backend)
          y tu misión diaria van juntos arriba del fold. Antes la misión era
          una sección suelta propia; fusionarla aquí recorta la home. */}
      <HomeSectionBoundary title="No pudimos mostrar el pulso">
        <SectionPulso />
        <section className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
          <DailyMissionPanel />
        </section>
      </HomeSectionBoundary>
      {/* La sección de stats se retiró: duplicaba 1:1 el panel de cifras
          del hero (personajes/torneos/universos/ELO máx) una pantalla más
          abajo. El top ranking sube y la home se acorta. */}
      <HomeSectionBoundary title="No pudimos mostrar el top ranking">
        <SectionTop10Ranking top10={top10} />
      </HomeSectionBoundary>
      {/* Recorte de home (F2): se retiraron el marquee de nombres, el bento
          "Plataforma" (feature-list estilo SaaS) y "Cómo funciona" (vive ya en
          /como-funciona) para que el ranking y las acciones no queden
          enterrados. LazyOnView monta el resto al acercarse al viewport. */}
      <LazyOnView minHeight={620}><SectionRetosDiarios /></LazyOnView>
      <LazyOnView minHeight={520}>
        <HomeSectionBoundary title="No pudimos mostrar torneos activos">
          <SectionTorneosActivos />
        </HomeSectionBoundary>
      </LazyOnView>
      <LazyOnView minHeight={520}><SectionPorAnime carousels={carousels} /></LazyOnView>
      </HomeCatalogGuard>
    </>
  )
}

function HomeCatalogGuard({ isLoading, isError, hasItems, onRetry, children }) {
  if (isLoading && !hasItems) return <HomeSkeleton />
  if (isError && !hasItems) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-12">
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar la portada"
          description="El catálogo de personajes no respondió. Reintenta para reconstruir rankings, juegos y secciones de la home."
          action={
            <button
              type="button"
              onClick={() => onRetry()}
              className="as-button-primary rounded-lg px-5 py-3 text-sm font-black"
            >
              Reintentar
            </button>
          }
        />
      </div>
    )
  }
  if (!hasItems) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-12">
        <EmptyState
          icon={Inbox}
          title="Aún no hay personajes en la arena"
          description="Cuando el catálogo tenga personajes, la portada montará rankings, torneos y universos automáticamente."
        />
      </div>
    )
  }
  return children
}

function HomeSectionBoundary({ title, children }) {
  return (
    <ErrorBoundary
      fallback={({ reset }) => (
        <div className="mx-auto w-full max-w-6xl px-5 py-8">
          <EmptyState
            icon={AlertTriangle}
            title={title}
            description="Esta sección se aisló para que el resto de la portada siga disponible."
            action={
              <button
                type="button"
                onClick={reset}
                className="as-button-ghost rounded-lg px-5 py-3 text-sm font-bold"
              >
                Reintentar sección
              </button>
            }
          />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
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
          <span className="text-[12px] font-semibold text-fg-muted">
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

function SectionTorneosActivos() {
  // Preview de los 3 primeros torneos del backend. Si aún cargan o falla
  // la llamada, la sección se renderiza sin grid (no asusta al usuario
  // con error message — el listado completo está en /torneos).
  const { data: torneos = [] } = useTorneos()
  const torneosPreview = torneos.slice(0, 3)
  if (torneosPreview.length === 0) return null
  return (
    <Section
      as={motion.section}
      containerClassName="mx-auto max-w-6xl"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      eyebrow="Torneos"
      title="Brackets en marcha"
      titleClassName="text-[clamp(1.75rem,4vw,2.5rem)] tracking-tight"
      eyebrowClassName="text-[12px] font-semibold text-fg-muted"
      headerClassName="mb-8 flex items-end justify-between gap-4"
      headerAction={
        <Link
          to="/torneos"
          className="hidden items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-gold sm:inline-flex"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {torneosPreview.map((t) => (
            <TorneoCard key={t.slug} torneo={t} />
          ))}
        </div>
    </Section>
  )
}

function SectionTop10Ranking({ top10 }) {
  if (top10.length === 0) return null

  return (
    <Section
      as={motion.section}
      className="bg-surface/40"
      containerClassName="mx-auto max-w-7xl"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      eyebrow="Top 10 · ELO base"
      title="Top 10 por ELO base"
      description="Orden estimado por popularidad del catálogo, no por votos. El ranking competitivo real, que sí se mueve con cada voto, está en /ranking."
      descriptionClassName="max-w-2xl text-[14px] text-fg-muted"
      headerClassName="mb-8 flex flex-wrap items-end justify-between gap-3"
      headerAction={
        <Button
          as={Link}
          to="/ranking"
          variant="secondary"
          className="group"
        >
          Ver ranking completo
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      }
    >
        <ol className="scrollbar-hide scroll-x-affordance scroll-x-fade -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
          {top10.map((p, i) => (
            <Top10Card key={p.slug} rank={i + 1} {...p} />
          ))}
        </ol>
    </Section>
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
          <Card
            as="div"
            className="aspect-[2/3] border border-border bg-surface p-0 transition-all group-hover:-translate-y-1 group-hover:border-accent/40"
          >
            <PersonajeImg
              slug={slug}
              alt={nombre}
              loading={highPriorityImage ? 'eager' : 'lazy'}
              fetchPriority={highPriorityImage ? 'high' : 'auto'}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Card>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-fg-strong group-hover:text-gold">
                {nombre}
              </p>
              <p className="truncate text-xs text-fg-muted">{anime}</p>
            </div>
            <p
              className="shrink-0 font-mono text-[12px] font-bold text-elo-number tabular-nums"
              title="ELO base estimado por popularidad. El ranking real por votos está en /ranking."
            >
              {elo}
              <span className="ml-0.5 text-[9px] font-bold text-elo-number/70">·b</span>
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
    to: '/games/oraculo',
    kanji: '心',
    titulo: 'Oráculo Anime',
    desc: 'Akinator por reglas · endless',
    color: 'cyan',
  },
  {
    to: '/games/anigrid',
    kanji: '格',
    titulo: 'AniGrid',
    desc: 'Wordle de personajes · 6 intentos',
    color: 'emerald',
  },
  {
    to: '/games/nexo-anime',
    kanji: '結',
    titulo: 'Nexo Anime',
    desc: 'Conexiones · 4 parejas',
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
  rose: 'border-danger/40 bg-danger/10 text-danger',
  amber: 'border-gold/40 bg-gold/10 text-gold',
  emerald: 'border-success/40 bg-success/10 text-success',
  purple: 'border-rarity-epic/40 bg-rarity-epic/10 text-rarity-epic',
  cyan: 'border-electric/40 bg-electric/10 text-electric',
}

function SectionRetosDiarios() {
  return (
    <Section
      as={motion.section}
      className="bg-surface/30"
      containerClassName="mx-auto max-w-6xl"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      eyebrow={<><span lang="ja">御</span> · Anime Daily Trials</>}
      title="Retos diarios de anime"
      description="Pon a prueba tu memoria otaku con modos rápidos: adivina personajes, detecta impostores y protege tu racha diaria."
      descriptionClassName="max-w-2xl text-[14px] text-fg-muted"
      headerClassName="mb-8 flex flex-wrap items-end justify-between gap-3"
      headerAction={
        <Button
          as={Link}
          to="/games"
          variant="secondary"
          className="group"
        >
          Jugar retos diarios
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      }
    >
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
              <Card
                as={Link}
                key={r.to}
                to={r.to}
                className={`group relative flex min-h-[13rem] flex-col gap-2 overflow-hidden rounded-2xl border bg-surface/85 p-5 transition-all duration-300 hover:-translate-y-1.5 hover:bg-surface hover:shadow-lift backdrop-blur-sm sm:min-h-[14rem] ${colorClasses}`}
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
                  style={{ textShadow: 'var(--text-shadow-glow)' }}
                >
                  {r.kanji}
                </span>
                <div
                  className={`relative z-10 mt-auto flex h-12 w-12 items-center justify-center rounded-lg border-2 backdrop-blur transition-all duration-300 group-hover:scale-105 group-hover:shadow-aura [--aura-color:currentColor] ${colorClasses}`}
                >
                  <span lang="ja" className="font-mono text-2xl font-extrabold">
                    {r.kanji}
                  </span>
                </div>
                <h3 className="relative z-10 text-base font-bold text-fg-strong drop-shadow-scrim transition-colors group-hover:text-gold sm:text-lg">
                  {r.titulo}
                </h3>
                <p className="relative z-10 text-xs text-fg-muted drop-shadow-scrim-sm sm:text-[13px]">
                  {r.desc}
                </p>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-4 bottom-2 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-accent/60 to-transparent transition-transform duration-300 group-hover:scale-x-100"
                />
              </Card>
            )
          })}
        </div>
    </Section>
  )
}

export default InicioPage
