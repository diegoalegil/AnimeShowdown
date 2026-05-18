import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Quote,
  Share2,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  personajes,
  imagenPersonaje,
  getIndicePersonaje,
  getStatsPersonaje,
} from '../data/personajes'
import { useSeo } from '../hooks/useSeo'
import { buscarPersonajeJikan } from '../lib/jikan'
import { citaPersonaje } from '../lib/animechan'
import { endpoints } from '../lib/api'
import { personajeSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import EloHistoryChart from '../components/EloHistoryChart'
import PersonajeCard from '../components/PersonajeCard'
import ReactionsBar from '../components/ReactionsBar'
import ShareButtons from '../components/ShareButtons'
import { usePersonajesSimilares } from '../hooks/usePersonajesSimilares'
import NotFoundPage from './NotFoundPage'

const Personaje3D = lazy(() => import('../components/Personaje3D'))

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

function PersonajeDetailPage() {
  const { slug } = useParams()
  const idx = getIndicePersonaje(slug)
  const personaje = idx === -1 ? null : personajes[idx]

  // Hooks SIEMPRE arriba del posible early-return — Rules of Hooks: el orden no
  // puede variar entre renders. Antes el `if (idx === -1) return <NotFoundPage />`
  // estaba antes del hook de title, lo que hacía crashear React con
  // "Rendered fewer hooks than expected" al navegar de slug válido a inválido.
  const stats = personaje ? getStatsPersonaje(slug) : null
  useSeo(
    personaje
      ? {
          title: `${personaje.nombre} de ${personaje.anime}${
            stats?.elo ? ` · ELO ${stats.elo}` : ''
          }`,
          description:
            personaje.descripcion ||
            `Stats, ranking ELO y ficha de ${personaje.nombre}, personaje de ${personaje.anime}, en AnimeShowdown.`,
          image: imagenPersonaje(personaje.slug),
          type: 'profile',
        }
      : { title: '404 — Personaje no encontrado', noindex: true },
  )
  const [jikan, setJikan] = useState(null)
  const [cita, setCita] = useState(null)

  useEffect(() => {
    if (!personaje) return
    let cancelado = false
    buscarPersonajeJikan(personaje.nombre, personaje.anime).then((d) => {
      if (!cancelado) setJikan(d)
    })
    citaPersonaje(personaje.nombre).then((q) => {
      if (!cancelado) setCita(q)
    })
    return () => {
      cancelado = true
    }
  }, [personaje])

  // Lista cacheada (10 min stale) para mapear slug → id del backend. La
  // necesitamos porque las reactions usan targetId=long del backend, no
  // el slug del catálogo client-side. Plan v2 §4.3.
  const { data: listaBackend } = useQuery({
    queryKey: ['personajes', 'lista'],
    queryFn: endpoints.personajes,
    staleTime: 10 * 60 * 1000,
  })
  const personajeBackendId = personaje && listaBackend
    ? listaBackend.find((p) => p.slug === personaje.slug)?.id
    : null

  if (idx === -1) return <NotFoundPage />

  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0
  const prev = personajes[(idx - 1 + personajes.length) % personajes.length]
  const next = personajes[(idx + 1) % personajes.length]

  // Rank global por ELO + rank dentro del anime. Una sola pasada por
  // anime para no recalcular varias veces durante el render.
  const eloOrdenado = [...personajes]
    .map((p) => ({ slug: p.slug, elo: getStatsPersonaje(p.slug).elo }))
    .sort((a, b) => b.elo - a.elo)
  const rankGlobal = eloOrdenado.findIndex((p) => p.slug === slug) + 1
  const animePersonajes = personajes.filter((p) => p.anime === personaje.anime)
  const rankAnime =
    [...animePersonajes]
      .sort((a, b) => getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo)
      .findIndex((p) => p.slug === slug) + 1

  const compartir = async () => {
    const url = `https://animeshowdown.dev/personajes/${slug}`
    const titulo = `${personaje.nombre} · ${personaje.anime} · AnimeShowdown`
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Enlace copiado al portapapeles')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        toast.error('No se pudo compartir')
      }
    }
  }
  // Plan v2 §5.6: hasta 10 personajes del mismo anime como internal linking
  // estructurado. Google sigue estos links para entender la red semántica
  // ("Akame ga Kill!" → 10 personajes del anime); más de 10 saturaría la
  // página y reduciría link equity por dilución.
  const relacionados = personajes
    .filter((p) => p.anime === personaje.anime && p.slug !== slug)
    .slice(0, 10)
  const totalAnime =
    personajes.filter((p) => p.anime === personaje.anime).length

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="personaje"
        schema={personajeSchema(personaje, stats)}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Personajes', path: '/personajes' },
          { label: personaje.nombre, path: `/personajes/${personaje.slug}` },
        ])}
      />
      <div className="mx-auto max-w-6xl">
        <Link
          to="/personajes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
        {/* Plan v2 §6.3: <article> con Microdata schema.org/Person para
            crawlers que prefieren Microdata sobre JSON-LD. Coexiste con
            el JsonLd de arriba sin contradecirse — Google da prioridad a
            JSON-LD pero algunos LLMs y scrapers parsean ambos. itemprop
            en name (H1), description (p), image (img/meta). */}
        <motion.article
          key={slug}
          itemScope
          itemType="https://schema.org/Person"
          className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:gap-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <meta
            itemProp="image"
            content={`https://animeshowdown.dev${imagenPersonaje(slug)}`}
          />
          <meta itemProp="url" content={`https://animeshowdown.dev/personajes/${slug}`} />
          {/* Audit visual (2026-05-18): en móvil reordenamos para que la
              identidad (badges + H1 + CTAs) aparezca antes que la imagen,
              y capamos la imagen a 55vh — antes empujaba todo el contenido
              fuera del primer viewport. En desktop el orden y el aspect-ratio
              originales se preservan vía md:* classes. */}
          <motion.div
            className="relative order-2 mx-auto aspect-[2/3] w-auto max-h-[55vh] overflow-hidden rounded-2xl border border-border bg-surface md:order-1 md:mx-0 md:w-full md:max-w-md md:max-h-none"
            style={{ filter: 'drop-shadow(0 30px 60px rgb(255 46 99 / 0.18))' }}
            variants={itemVariants}
          >
            {/* Audit (2026-05-17): Personaje3D era opt-in al mount con
                imagen como fallback, pero el chunk se descargaba siempre
                al entrar a la ficha y disparaba 'THREE.Clock deprecated'
                en consola. Cambio a static-first: imagen como default y
                un botón 'Ver en 3D' monta el lazy chunk on-demand. */}
            <PersonajeStaticOr3D slug={slug} nombre={personaje.nombre} />
          </motion.div>
          <motion.div
            className="order-1 flex flex-col items-start gap-4 md:order-2"
            variants={containerVariants}
          >
            <motion.div
              className="flex flex-wrap items-center gap-2"
              variants={itemVariants}
            >
              {rankGlobal <= 100 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-yellow-200">
                  <Trophy className="h-3 w-3" />
                  #{rankGlobal} ranking ELO
                </span>
              )}
              {animePersonajes.length > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
                  #{rankAnime} de {personaje.anime}
                </span>
              )}
              <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
                Personaje {idx + 1} de {personajes.length}
                {jikan?.favorites != null && (
                  <>
                    {' · '}
                    <Star className="ml-1 inline h-3 w-3 text-accent" />{' '}
                    {jikan.favorites.toLocaleString('es-ES')} fans
                  </>
                )}
              </span>
            </motion.div>
            <motion.h1
              itemProp="name"
              className="text-[clamp(2rem,5vw,3.5rem)] leading-tight tracking-tight"
              variants={itemVariants}
            >
              {personaje.nombre}
            </motion.h1>
            <motion.p
              className="text-lg text-fg-muted"
              variants={itemVariants}
            >
              de{' '}
              <span
                itemProp="affiliation"
                itemScope
                itemType="https://schema.org/TVSeries"
                className="font-semibold text-fg-strong"
              >
                <span itemProp="name">{personaje.anime}</span>
              </span>
            </motion.p>
            <motion.div
              className="flex flex-wrap gap-2"
              variants={itemVariants}
            >
              <Link
                to="/votar"
                className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Votar ahora
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/ranking"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/20"
              >
                <TrendingUp className="h-4 w-4" />
                Ver en ranking
              </Link>
              <button
                type="button"
                onClick={compartir}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-accent"
              >
                <Share2 className="h-4 w-4" />
                Compartir ficha
              </button>
            </motion.div>
            {personajeBackendId && (
              <motion.div variants={itemVariants}>
                <ReactionsBar
                  targetType="PERSONAJE"
                  targetId={personajeBackendId}
                />
              </motion.div>
            )}
            <motion.div
              className="grid w-full grid-cols-3 gap-3"
              variants={itemVariants}
            >
              <Stat label="ELO" value={stats.elo} accent />
              <Stat
                label="Récord"
                value={`${stats.wins}-${stats.losses}`}
              />
              <Stat label="Win rate" value={`${winRate}%`} />
            </motion.div>
            {total === 0 && (
              <motion.p
                className="text-[12px] italic text-fg-muted"
                variants={itemVariants}
              >
                Stats disponibles cuando participe en más enfrentamientos.
              </motion.p>
            )}
            {personaje.descripcion && (
              <motion.div
                className="rounded-lg border border-border bg-surface p-4"
                variants={itemVariants}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                  Sobre el personaje
                </p>
                <p itemProp="description" className="mt-2 text-sm leading-relaxed text-fg">
                  {personaje.descripcion}
                </p>
                {jikan?.nicknames?.length > 0 && (
                  <p className="mt-3 text-[12px] text-fg-muted">
                    También conocido como:{' '}
                    <span className="text-fg-strong">
                      {jikan.nicknames.slice(0, 4).join(', ')}
                    </span>
                  </p>
                )}
              </motion.div>
            )}
            {cita && (
              <motion.blockquote
                className="relative w-full rounded-lg border border-accent/30 bg-accent-soft p-4 pl-10"
                variants={itemVariants}
              >
                <Quote className="absolute left-3 top-3 h-5 w-5 text-accent" />
                <p className="text-sm italic leading-relaxed text-fg-strong">
                  {cita.content}
                </p>
                {(cita.character || cita.anime) && (
                  <cite className="mt-2 block text-[12px] not-italic text-fg-muted">
                    — {cita.character}
                    {cita.anime && (
                      <>
                        {' · '}
                        <span>{cita.anime}</span>
                      </>
                    )}
                  </cite>
                )}
              </motion.blockquote>
            )}
            <motion.p
              className="text-[12px] leading-relaxed text-fg-muted"
              variants={itemVariants}
            >
              Stats derivadas del historial de enfrentamientos. Cita y nicknames vía AnimeChan/MyAnimeList cuando están disponibles.
            </motion.p>
            <motion.div
              className="mt-2 flex w-full items-center justify-between gap-3 border-t border-border pt-4"
              variants={itemVariants}
            >
              <Link
                to={`/personajes/${prev.slug}`}
                aria-label={`Ir al personaje anterior: ${prev.nombre} de ${prev.anime}`}
                title={`${prev.nombre} de ${prev.anime}`}
                className="inline-flex flex-col items-start gap-0 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-fg-muted">
                  <ArrowLeft className="h-3 w-3" />
                  Anterior
                </span>
                <span className="font-semibold">{prev.nombre}</span>
              </Link>
              <Link
                to={`/personajes/${next.slug}`}
                aria-label={`Ir al personaje siguiente: ${next.nombre} de ${next.anime}`}
                title={`${next.nombre} de ${next.anime}`}
                className="inline-flex flex-col items-end gap-0 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
              >
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-fg-muted">
                  Siguiente
                  <ArrowRight className="h-3 w-3" />
                </span>
                <span className="font-semibold">{next.nombre}</span>
              </Link>
            </motion.div>
          </motion.div>
        </motion.article>

        <div className="mt-10">
          <EloHistoryChart slug={slug} />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Comparte la ficha de {personaje.nombre}
          </p>
          <ShareButtons
            url={typeof window !== 'undefined'
              ? `${window.location.origin}/personajes/${slug}`
              : `https://animeshowdown.dev/personajes/${slug}`}
            texto={`${personaje.nombre} de ${personaje.anime} en AnimeShowdown`}
          />
        </div>

        {relacionados.length > 0 && (
          <div className="mt-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                  Mismo universo
                </span>
                <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
                  Más personajes de {personaje.anime}
                </h2>
              </div>
              {totalAnime > relacionados.length + 1 && (
                <Link
                  to={`/personajes?anime=${encodeURIComponent(personaje.anime)}`}
                  className="text-[13px] font-semibold text-accent hover:underline"
                >
                  Ver los {totalAnime} personajes de {personaje.anime} →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {relacionados.map((p) => (
                <PersonajeCard key={p.slug} {...p} />
              ))}
            </div>
            <p className="mt-6 text-[13px] text-fg-muted">
              ¿No conoces a alguno? Pulsa cualquier card para ver su ficha
              completa con stats, citas y ranking ELO. También puedes{' '}
              <Link
                to="/ranking"
                className="text-accent hover:underline"
              >
                ver el ranking global de personajes
              </Link>{' '}
              o{' '}
              <Link
                to="/torneos"
                className="text-accent hover:underline"
              >
                explorar torneos activos
              </Link>
              .
            </p>
          </div>
        )}

        <CarruselSimilares slug={slug} nombre={personaje.nombre} />
      </div>
    </section>
  )
}

/**
 * Carrusel de personajes recomendados cross-anime (Plan v2 §4.12).
 *
 * <p>Se monta debajo de "Mismo universo" en la ficha de personaje.
 * Backend devuelve top N por similitud de votos. Scroll horizontal con
 * snap + flechas prev/next desktop.
 */
function CarruselSimilares({ slug, nombre }) {
  const { data, isLoading } = usePersonajesSimilares(slug, { limit: 10 })
  const scrollRef = useRef(null)

  const handleScroll = (dir) => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  if (isLoading) return null
  if (!data || data.length === 0) return null

  return (
    <div className="mt-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            <Sparkles className="h-3 w-3 text-accent" />
            Más allá del universo
          </span>
          <h2 className="text-xl font-bold text-fg-strong sm:text-2xl">
            Si te gusta {nombre}, también te gustarán
          </h2>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => handleScroll(-1)}
            aria-label="Anterior"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll(1)}
            aria-label="Siguiente"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 scroll-smooth sm:-mx-8 sm:px-8"
      >
        {data.map((p) => (
          <div
            key={p.slug}
            className="w-[140px] flex-none snap-start sm:w-[160px] lg:w-[180px]"
          >
            <PersonajeCard slug={p.slug} nombre={p.nombre} anime={p.anime} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-fg-muted">
        Recomendaciones basadas en proximidad de votos en el ranking global.
      </p>
    </div>
  )
}

/**
 * Render static-first del personaje. Por defecto img + botón "Ver en 3D".
 * Al hacer click, monta el chunk lazy de Personaje3D. Evita pagar el
 * coste de three.js/Three Fiber en cada visita a la ficha.
 */
function PersonajeStaticOr3D({ slug, nombre }) {
  const [show3D, setShow3D] = useState(false)
  if (!show3D) {
    return (
      <div className="relative h-full w-full">
        <img
          src={imagenPersonaje(slug)}
          alt={nombre}
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={() => setShow3D(true)}
          className="absolute bottom-3 right-3 rounded-full border border-border bg-surface/85 px-3 py-1.5 text-[11px] font-semibold text-fg-strong backdrop-blur transition-colors hover:border-accent hover:text-accent"
        >
          Ver en 3D
        </button>
      </div>
    )
  }
  return (
    <Suspense
      fallback={
        <img
          src={imagenPersonaje(slug)}
          alt={nombre}
          className="h-full w-full object-cover"
        />
      }
    >
      <Personaje3D slug={slug} />
    </Suspense>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-bold ${
          accent ? 'text-accent' : 'text-fg-strong'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default PersonajeDetailPage
