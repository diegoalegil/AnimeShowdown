import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { organizationSchema, webSiteSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import {
  AlertTriangle,
  Inbox,
} from 'lucide-react'
import { AppLink } from '../components/AppLink'
import HearthHero from '../components/HearthHero'
import SectionCombateEstelar from '../components/SectionCombateEstelar'
import SectionGate from '../components/SectionGate'
import SectionPulso from '../components/SectionPulso'
import TorneoCard from '../components/TorneoCard'
import CarouselRow from '../components/CarouselRow'
import LazyOnView from '../components/LazyOnView'
import DailyMissionPanel from '../components/DailyMissionPanel'
import SobreBienvenidaBanner from '../features/cartas/SobreBienvenidaBanner'
import Card from '../components/Card'
import Section from '../components/Section'
import EmptyState from '../components/EmptyState'
import ErrorBoundary from '../components/ErrorBoundary'
import { HomeSkeleton } from '../components/PageSkeleton'
import { homeSectionReserve } from '../components/home-section-reserves'
import { useTorneos } from '../lib/torneosQueries'
import { getStatsPersonaje, imagenPersonaje } from '../lib/personajes-core'
import { markPersonajeHero } from '../lib/viewTransitions'
import { useSound } from '../contexts/SoundContext'
import { getGameVisual } from '../data/visual-assets'
import ColiseoTop10 from '../features/home/ColiseoTop10'
import HomeStreakEmber from '../features/home/HomeStreakEmber'
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
  const universos = useMemo(
    () => new Set(catalogoPersonajes.map((p) => p.anime)).size,
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
      <JsonLd id="organization" schema={organizationSchema()} />
      {/* Jerarquía de la portada: el hogar (hero) → combate estelar
          (cartel del día) → pulso + misión diaria → top ranking → retos
          diarios → torneos → explora por universo. Primero entender la
          propuesta, luego una acción clara, luego ranking y el resto a
          explorar. */}
      <HearthHero />
      <SobreBienvenidaBanner />
      <HomeCatalogGuard
        isLoading={isCatalogLoading}
        isError={isCatalogError}
        hasItems={catalogoPersonajes.length > 0}
        onRetry={refetchCatalogo}
      >
      {/* Combate estelar: el cartel del duelo del día justo tras el hero.
          LazyOnView lo saca del primer paint (el hero sigue siendo el LCP).
          Las reservas de TODAS las secciones viven en HOME_SECTION_RESERVES
          (PageSkeleton): una sola calibración para el skeleton y para estos
          minHeight — medidas @390px, la menor, para no sobre-reservar. */}
      <LazyOnView minHeight={homeSectionReserve('combate-estelar')}>
        <HomeSectionBoundary title="No pudimos mostrar el combate estelar">
          <SectionCombateEstelar />
        </HomeSectionBoundary>
      </LazyOnView>
      {/* Bloque "en vivo" (F2): el Pulso (cinco señales reales del backend)
          y tu misión diaria van juntos arriba del fold. Antes la misión era
          una sección suelta propia; fusionarla aquí recorta la home. */}
      <HomeSectionBoundary title="No pudimos mostrar el pulso">
        <SectionPulso />
        {/* lang interim: el cuerpo de la home aún es es-only (los locales
            en/ja cubren hero/combate); marcarlo evita que un SR en en/ja
            pronuncie español con fonética inglesa/japonesa. */}
        <section lang="es" className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
          <div className="mb-4">
            <HomeStreakEmber />
          </div>
          <DailyMissionPanel />
        </section>
      </HomeSectionBoundary>
      {/* La sección de stats sigue retirada: el hogar (hero) muestra las
          dos señales vivas (votos de la comunidad / torneos en marcha) y
          la escala del catálogo (personajes/universos, cifras exactas)
          vive en la puerta de "Explora por universo". eloMax se retiró a
          propósito por ser estimación, no dato competitivo. */}
      {/* Coliseo: única sección below-the-fold que montaba en el primer
          paint (anillo 3D = ~30 <img> + escena perspective + rAF). LazyOnView
          difiere el mount como sus vecinas; el pause al salir del viewport
          lo da el gate IO interno del propio anillo. minHeight = sección
          h-[680px] + cabecera/descripción del wrapper. */}
      <LazyOnView minHeight={homeSectionReserve('ranking')}>
        <HomeSectionBoundary title="No pudimos mostrar el top ranking">
          <SectionTop10Ranking top10={top10} />
        </HomeSectionBoundary>
      </LazyOnView>
      {/* Recorte de home (F2): se retiraron el marquee de nombres, el bento
          "Plataforma" (feature-list estilo SaaS) y "Cómo funciona" (vive ya en
          /como-funciona) para que el ranking y las acciones no queden
          enterrados. LazyOnView monta el resto al acercarse al viewport. */}
      <LazyOnView minHeight={homeSectionReserve('daily-trials')}><SectionRetosDiarios /></LazyOnView>
      <LazyOnView minHeight={homeSectionReserve('tournaments')}>
        <HomeSectionBoundary title="No pudimos mostrar torneos activos">
          <SectionTorneosActivos />
        </HomeSectionBoundary>
      </LazyOnView>
      <LazyOnView minHeight={homeSectionReserve('anime-universes')}>
        <SectionPorAnime
          carousels={carousels}
          totalPersonajes={catalogoPersonajes.length}
          totalUniversos={universos}
        />
      </LazyOnView>
      </HomeCatalogGuard>
    </>
  )
}

function HomeCatalogGuard({ isLoading, isError, hasItems, onRetry, children }) {
  if (isLoading && !hasItems) return <HomeSkeleton />
  if (isError && !hasItems) {
    return (
      <div lang="es" className="mx-auto w-full max-w-6xl px-5 py-12">
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
      <div lang="es" className="mx-auto w-full max-w-6xl px-5 py-12">
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
        <div lang="es" className="mx-auto w-full max-w-6xl px-5 py-8">
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

function SectionPorAnime({ carousels, totalPersonajes, totalUniversos }) {
  if (carousels.length === 0) return null

  return (
    <motion.div
      lang="es"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
    >
      <div className="mx-auto max-w-7xl px-5 pb-2 pt-12 sm:px-8 sm:pt-16">
        {/* La escala del catálogo (cifras EXACTAS, no "1000+") vive aquí
            desde que el hogar dejó el panel de stats: es la puerta natural
            — explora N personajes de M universos. */}
        <SectionGate
          kanji="界"
          kanjiMeaning="mundo, esfera"
          eyebrow={`${totalPersonajes} personajes · ${totalUniversos} universos`}
          title="Explora por universo"
          viewAllTo="/animes"
          viewAllLabel="Ver todos"
        />
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
      lang="es"
      containerClassName="mx-auto max-w-6xl"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
        <SectionGate
          id="torneos"
          kanji="戦"
          kanjiMeaning="batalla"
          eyebrow="Torneos"
          title="Brackets en marcha"
          viewAllTo="/torneos"
          viewAllLabel="Ver todos"
          className="mb-8"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {torneosPreview.map((t) => (
            <TorneoCard key={t.slug} torneo={t} />
          ))}
        </div>
    </Section>
  )
}

// Rango en kanji por posición (números japoneses): flavor sin coste de datos.
const KANJI_RANGO = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function SectionTop10Ranking({ top10 }) {
  const navigate = useNavigate()
  const { play } = useSound()
  const items = useMemo(
    () =>
      top10.map((p, i) => ({
        slug: p.slug,
        name: p.nombre,
        anime: p.anime,
        elo: p.elo,
        kanji: KANJI_RANGO[i] ?? '戦',
        image: imagenPersonaje(p.slug),
      })),
    [top10],
  )
  if (top10.length < 10) return null

  return (
    <Section
      as={motion.section}
      lang="es"
      className="bg-surface/40"
      containerClassName="mx-auto max-w-7xl"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      <div className="mb-8">
        <SectionGate
          kanji="位"
          kanjiMeaning="rango, posición"
          eyebrow="Top 10 · ELO base"
          title="Coliseo de Leyendas"
          viewAllTo="/ranking"
          viewAllLabel="Ver ranking completo"
        />
        <p className="mt-3 max-w-2xl text-[14px] text-fg-muted">
          El top 10 por ELO base gira en la arena: arrastra el anillo o usa
          las flechas, y toca la carta frontal para abrir su ficha. Orden
          estimado por popularidad, no por votos — el ranking competitivo
          real está en /ranking.
        </p>
      </div>
      <ColiseoTop10
        items={items}
        onOpen={(slug, retrato) => {
          play('playWhoosh')
          // El retrato frontal del coliseo viaja hasta el hero del detalle
          // (mismo morph que tenían las cartas del top 10 anterior).
          markPersonajeHero(retrato)
          navigate(`/personajes/${slug}`)
        }}
      />
    </Section>
  )
}

const RETOS_DIARIOS = [
  {
    to: '/games/shadow-guess',
    kanji: '影',
    titulo: 'Shadow Guess',
    desc: 'Sombra tras el biombo · 5 intentos',
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
    desc: '5 cartas · 1 traidor',
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
      lang="es"
      className="bg-surface/30"
      containerClassName="mx-auto max-w-6xl"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      <div className="mb-8">
        <SectionGate
          kanji="遊"
          kanjiMeaning="jugar"
          eyebrow={<><span lang="ja">御</span> · Anime Daily Trials</>}
          title="Retos diarios de anime"
          viewAllTo="/games"
          viewAllLabel="Jugar retos diarios"
        />
        <p className="mt-3 max-w-2xl text-[14px] text-fg-muted">
          Pon a prueba tu memoria otaku con modos rápidos: adivina
          personajes, detecta impostores y protege tu racha diaria.
        </p>
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
              <Card
                as={AppLink}
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
