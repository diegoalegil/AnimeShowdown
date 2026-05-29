import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
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
  canonicalPersonajeSlug,
} from '../lib/personajes-core'
import { useSeo } from '../hooks/useSeo'
import { buscarPersonajeJikan } from '../lib/jikan'
import { citaPersonaje } from '../lib/animechan'
import { endpoints } from '../lib/api'
import { personajeSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import EloHistoryChart from '../components/EloHistoryChart'
import HistorialCompetitivo from '../components/HistorialCompetitivo'
import PersonajeCard from '../components/PersonajeCard'
import PersonajeCardHolo from '../components/PersonajeCardHolo'
import PersonajeCutImg from '../components/PersonajeCutImg'
import PersonajeGaleria from '../components/PersonajeGaleria'
import PersonajeImg from '../components/PersonajeImg'
import { hasCut } from '../lib/cuts'
import ReactionsBar from '../components/ReactionsBar'
import SeguirPersonajeButton from '../components/SeguirPersonajeButton'
import ShareButtons from '../components/ShareButtons'
import ComentariosPersonaje from '../components/ComentariosPersonaje'
import { usePersonajesSimilares } from '../hooks/usePersonajesSimilares'
import NotFoundPage from './NotFoundPage'
import { VisualPageShell } from '../components/VisualSystem'
import { getAnimeVisual } from '../data/visual-assets'
import { slugifyAnime } from '../lib/animes'
import { shareOrCopy } from '../lib/share'
import { recordDailyShare } from '../lib/dailyProgress'
import {
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'
import RetoRecomendado from '../features/personajes/components/RetoRecomendado'
import { getRetoRecomendado } from '../features/personajes/reto-recomendado'

const loadPersonaje3D = () => import('../components/Personaje3D')
const Personaje3D = lazy(loadPersonaje3D)

function preloadPersonaje3DOnIdle() {
  if (typeof window === 'undefined') return
  const preload = () => {
    void loadPersonaje3D()
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 1800 })
  } else {
    window.setTimeout(preload, 250)
  }
}

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
  const { slug: slugParam } = useParams()
  const slug = canonicalPersonajeSlug(slugParam)
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
          // El ELO en el title necesita contexto para no indexarse como si
          // fuera ELO competitivo real.
          // "ELO base" deja claro que es el cold-start estimado del catálogo
          // — el ranking competitivo real está en /ranking.
          title: `${personaje.nombre} de ${personaje.anime}${
            stats?.elo ? ` · ELO base ${stats.elo}` : ''
          }`,
          description:
            personaje.descripcion ||
            `Ficha de ${personaje.nombre}, personaje de ${personaje.anime}, en AnimeShowdown. ELO base estimado + posición en el ranking competitivo.`,
          image: `/api/og/personaje/${personaje.slug}.png`,
          type: 'profile',
        }
      : { title: '404 — Personaje no encontrado', noindex: true },
  )
  const [jikan, setJikan] = useState(null)
  const [cita, setCita] = useState(null)
  // Imagen mostrada en el hero. Default = imagen del catálogo. La galería
  // (PersonajeGaleria) actualiza este state al clickar una thumbnail.
  // Reset al cambiar de slug usando el patrón "storing info from previous
  // renders" de React docs — evita el anti-patrón useEffect+setState que
  // dispara un render extra: https://react.dev/reference/react/useState
  const imagenCatalogo = personaje ? imagenPersonaje(slug) : null
  const [imagenActiva, setImagenActiva] = useState(imagenCatalogo)
  const [slugAnterior, setSlugAnterior] = useState(slug)
  if (slug !== slugAnterior) {
    setSlugAnterior(slug)
    setImagenActiva(imagenCatalogo)
  }

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
  // el slug del catálogo client-side. 3.
  const { data: listaBackend } = useQuery({
    queryKey: ['personajes', 'lista'],
    queryFn: endpoints.personajes,
    staleTime: 10 * 60 * 1000,
  })
  const personajeBackendId = personaje && listaBackend
    ? listaBackend.find((p) => p.slug === personaje.slug)?.id
    : null

  const [localVotes, setLocalVotes] = useState(() => readLocalVotes())
  useEffect(
    () => listenLocalVotes((nextVotes) => setLocalVotes(nextVotes)),
    [],
  )
  const personalLocalStats = useMemo(
    () => getLocalVoteStats(localVotes),
    [localVotes],
  )

  if (idx !== -1 && slugParam !== slug) {
    return <Navigate to={`/personajes/${slug}`} replace />
  }

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
  const personalRankIndex = personalLocalStats.top.findIndex((item) => item.slug === slug)
  const personalSignal = personalRankIndex >= 0
    ? {
        rank: personalRankIndex + 1,
        count: personalLocalStats.top[personalRankIndex].count,
        total: personalLocalStats.total,
      }
    : null

  const compartir = async () => {
    const titulo = `${personaje.nombre} · ${personaje.anime} · AnimeShowdown`
    const personalLine = personalSignal
      ? `En mi ranking personal va #${personalSignal.rank} con ${personalSignal.count} voto${personalSignal.count === 1 ? '' : 's'} mío${personalSignal.count === 1 ? '' : 's'}.`
      : ''
    try {
      const result = await shareOrCopy({
        title: titulo,
        text: [
          `${personaje.nombre} de ${personaje.anime} está en AnimeShowdown con ELO base ${stats.elo}. ¿Lo subirías en el ranking?`,
          personalLine,
        ].filter(Boolean).join('\n'),
        url: `/personajes/${slug}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Ficha compartida' : 'Ficha copiada')
    } catch (e) {
      toast.error('No se pudo compartir', {
        description: e?.message || 'Copia el enlace manualmente.',
      })
    }
  }
  // Hasta 10 personajes del mismo anime como internal linking estructurado.
  // Google sigue estos links para entender la red semántica
  // ("Akame ga Kill!" → 10 personajes del anime); más de 10 saturaría la
  // página y reduciría link equity por dilución.
  const relacionados = personajes
    .filter((p) => p.anime === personaje.anime && p.slug !== slug)
    .slice(0, 10)
  const duelosPopulares = getDuelosPopulares(personaje)
  const retoRecomendado = getRetoRecomendado(personaje)
  const totalAnime =
    personajes.filter((p) => p.anime === personaje.anime).length
  // Visual del anime al que pertenece el personaje: usa el banner editorial
  // del universo (naruto.webp, demon-slayer.webp...) como ambient hero
  // detras del shell, en lugar de la as-stage genérica.
  const animeSlug = slugifyAnime(personaje.anime)
  const visualAnime = getAnimeVisual(animeSlug, personaje.anime)
  const compartirRetoRecomendado = async () => {
    if (!retoRecomendado) return
    const rival = retoRecomendado.personaje
    try {
      const result = await shareOrCopy({
        title: `${personaje.nombre} vs ${rival.nombre}`,
        text: [
          `Reto recomendado en AnimeShowdown: ${personaje.nombre} vs ${rival.nombre}.`,
          `Diferencia ELO base: ${retoRecomendado.delta} puntos.`,
          '¿A quién subirías votando?',
        ].join('\n'),
        url: `/duelos/${personaje.slug}-vs-${rival.slug}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Reto compartido' : 'Reto copiado')
    } catch (error) {
      toast.error('No se pudo compartir el reto', {
        description: error?.message || 'Copia el enlace manualmente.',
      })
    }
  }

  return (
    <VisualPageShell
      visual={visualAnime}
      contentClassName="mx-auto max-w-6xl"
      density="low"
      lateralKanji={{ left: visualAnime?.kanji ?? '人', right: '心' }}
    >
      <JsonLd
        id="personaje"
        schema={personajeSchema(personaje, stats, {
          rankGlobal,
          rankAnime,
          totalAnime,
          totalCatalogo: personajes.length,
        })}
      />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Personajes', path: '/personajes' },
          { label: personaje.nombre, path: `/personajes/${personaje.slug}` },
        ])}
      />
        <Link
          to="/personajes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
        {/* 3: <article> con Microdata schema.org/Person para
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
          {/* En móvil la identidad aparece antes que la imagen y la imagen se
              capa a 55vh; en desktop se preservan el orden y aspect-ratio. */}
          <motion.div
            className="order-2 mx-auto flex w-full min-w-0 max-w-sm flex-col md:order-1 md:mx-0 md:max-w-md"
            variants={itemVariants}
          >
            {/* El contenedor limita la galería en mobile para evitar overflow
                horizontal cuando hay muchas miniaturas. */}
            <div
              className="relative mx-auto aspect-[2/3] max-h-[55vh] w-auto overflow-hidden rounded-2xl border border-border bg-surface md:mx-0 md:w-full md:max-h-none"
              style={{ filter: 'drop-shadow(0 30px 60px rgb(159 29 44 / 0.22))' }}
            >
              {/* Personaje3D era opt-in al mount con
                  imagen como fallback, pero el chunk se descargaba siempre
                  al entrar a la ficha y disparaba 'THREE.Clock deprecated'
                  en consola. Cambio a static-first: imagen como default y
                  un botón 'Ver en 3D' monta el lazy chunk on-demand.

                  Galería: la imagen del hero ahora
                  es la del state `imagenActiva` que PersonajeGaleria
                  cambia al hacer click en una thumbnail. PersonajeStaticOr3D
                  recibe la URL como prop en vez de calcularla. */}
              <PersonajeStaticOr3D
                imagenUrl={imagenActiva}
                fallbackUrl={imagenCatalogo}
                slug={slug}
                nombre={personaje.nombre}
              />
            </div>
            <PersonajeGaleria
              slug={slug}
              principalUrl={imagenCatalogo}
              imagenActiva={imagenActiva}
              onSelect={setImagenActiva}
            />
            {/* Carta + FIGURA juntas (B2): además de la carta holo de arriba,
                mostramos la figura recortada sin marco cuando existe. Da el
                "personaje en pose" que pedía el feedback. La resolución de los
                recortes se mejora regenerándolos (scripts/regen-cuts.mjs), no
                con CSS — por ahora se muestra el recorte disponible. */}
            {hasCut(slug) && (
              <figure className="mt-4">
                <PersonajeCutImg
                  slug={slug}
                  alt={`Figura recortada de ${personaje.nombre}`}
                  loading="lazy"
                  className="mx-auto aspect-[3/4] max-h-[40vh] w-full rounded-2xl border border-border md:max-h-[44vh]"
                />
                <figcaption className="mt-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                  Figura · sin marco
                </figcaption>
              </figure>
            )}
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
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-medal-gold/40 bg-medal-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-medal-gold"
                  title="Ranking del catálogo según ELO base estimado (popularidad). El ranking competitivo real vive en /ranking."
                >
                  <Trophy className="h-3 w-3" />
                  #{rankGlobal} ELO base
                </span>
              )}
              {animePersonajes.length > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
                  #{rankAnime} de {personaje.anime}
                </span>
              )}
              <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
                Personaje {idx + 1} de {personajes.length}
              </span>
              {jikan?.favorites != null && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted"
                  title="Favoritos contados por MyAnimeList — métrica externa, no del ranking interno de AnimeShowdown"
                >
                  <Star className="h-3 w-3 text-gold" />
                  {jikan.favorites.toLocaleString('es-ES')} fans MAL
                </span>
              )}
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
                to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
                className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Retar a este personaje
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to={`/ranking?q=${encodeURIComponent(personaje.nombre)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
              >
                <TrendingUp className="h-4 w-4" />
                Ver en ranking
              </Link>
              <Link
                to={`/mi-top5?add=${encodeURIComponent(personaje.slug)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-sm font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/55 hover:text-gold"
              >
                <Sparkles className="h-4 w-4" />
                Llevar a mi Top 5
              </Link>
              <button
                type="button"
                onClick={compartir}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
              >
                <Share2 className="h-4 w-4" />
                Compartir ficha
              </button>
              <SeguirPersonajeButton slug={slug} nombre={personaje.nombre} />
            </motion.div>
            <PersonalCharacterSignal
              personaje={personaje}
              signal={personalSignal}
              totalVotes={personalLocalStats.total}
            />
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
              {/* El "ELO" mostrado aquí viene de getStatsPersonaje(slug);
                  es determinístico y no se mueve con los votos. Lo
                  etiquetamos como base/estimado y apuntamos al ranking real. */}
              <Stat label="ELO base" value={stats.elo} accent />
              <Stat
                label="Récord est."
                value={`${stats.wins}-${stats.losses}`}
              />
              <Stat label="Win rate est." value={`${winRate}%`} />
            </motion.div>
            {total === 0 && (
              <motion.p
                className="text-[12px] italic text-fg-muted"
                variants={itemVariants}
              >
                ELO base estimado por popularidad · sin partidas registradas
                con tus votos todavía.
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
                <Quote className="absolute left-3 top-3 h-5 w-5 text-gold" />
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
              {/* Estas stats se calculan desde el slug y una tabla de
                  popularidad estimada, no desde votos reales. El ranking
                  ponderado vive en /ranking. */}
              ELO base estimado por popularidad para el cold-start del
              catálogo. El{' '}
              <Link
                to="/ranking"
                className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
              >
                ranking competitivo
              </Link>
              {' '}lo mueven los votos reales de la comunidad. Cita y nicknames vía AnimeChan/MyAnimeList cuando están disponibles.
            </motion.p>
            <motion.div
              className="mt-2 flex w-full items-center justify-between gap-3 border-t border-border pt-4"
              variants={itemVariants}
            >
              <Link
                to={`/personajes/${prev.slug}`}
                aria-label={`Ir al personaje anterior: ${prev.nombre} de ${prev.anime}`}
                title={`${prev.nombre} de ${prev.anime}`}
                className="inline-flex flex-col items-start gap-0 text-sm font-medium text-fg-muted transition-colors hover:text-gold"
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
                className="inline-flex flex-col items-end gap-0 text-sm font-medium text-fg-muted transition-colors hover:text-gold"
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

        {retoRecomendado && (
          <RetoRecomendado
            personaje={personaje}
            stats={stats}
            rival={retoRecomendado.personaje}
            rivalStats={retoRecomendado.stats}
            delta={retoRecomendado.delta}
            tipo={retoRecomendado.tipo}
            onShare={compartirRetoRecomendado}
          />
        )}

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

        <ComentariosPersonaje slug={slug} nombre={personaje.nombre} />

        {duelosPopulares.length > 0 && (
          <section className="mt-8 rounded-xl border border-accent/25 bg-[linear-gradient(135deg,rgb(159_29_44_/_0.10),rgb(20_20_30_/_0.92))] p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
                  <Swords className="h-3.5 w-3.5" />
                  Duelos populares
                </span>
                <h2 className="mt-1 text-xl font-bold text-fg-strong">
                  ¿Contra quién pondrías a {personaje.nombre}?
                </h2>
              </div>
              <Link
                to="/votar"
                className="text-[13px] font-semibold text-gold hover:underline"
              >
                Votar ahora →
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {duelosPopulares.map((rival) => (
                <Link
                  key={rival.slug}
                  to={`/duelos/${personaje.slug}-vs-${rival.slug}`}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-bg/45 p-2.5 transition-colors hover:border-accent/50 hover:bg-accent-soft"
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
                    <PersonajeImg
                      slug={rival.slug}
                      alt={rival.nombre}
                      className="h-full w-full object-cover"
                      sizes="44px"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg-strong">
                      {personaje.nombre} vs {rival.nombre}
                    </span>
                    <span className="block truncate text-[12px] text-fg-muted">
                      {rival.anime}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

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
                  className="text-[13px] font-semibold text-gold hover:underline"
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
              completa con ELO base, citas y posición en el ranking
              competitivo. También puedes{' '}
              <Link
                to="/ranking"
                className="text-gold hover:underline"
              >
                ver el ranking competitivo de personajes
              </Link>{' '}
              o{' '}
              <Link
                to="/torneos"
                className="text-gold hover:underline"
              >
                explorar torneos activos
              </Link>
              .
            </p>
          </div>
        )}

        {/* Historial competitivo: "Últimos duelos" + "Contra quién".
            Lo metemos aquí, entre "Mismo
            universo" y "Más allá del universo", para que el bloque
            historial-competitivo aparezca tras los datos básicos pero
            antes del discovery cross-anime. */}
      <HistorialCompetitivo slug={slug} nombre={personaje.nombre} />

      <CarruselSimilares slug={slug} nombre={personaje.nombre} />
    </VisualPageShell>
  )
}

function PersonalCharacterSignal({ personaje, signal, totalVotes }) {
  if (!personaje || (!signal && totalVotes <= 0)) return null

  return (
    <motion.div
      variants={itemVariants}
      className={`w-full rounded-xl border p-4 ${
        signal
          ? 'border-gold/35 bg-gold-soft'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-gold">
            <Flame className="h-3.5 w-3.5" />
            Tu ranking personal
          </p>
          {signal ? (
            <>
              <p className="mt-1 text-lg font-black text-fg-strong">
                #{signal.rank} para ti · {signal.count} voto{signal.count === 1 ? '' : 's'} tuyo{signal.count === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                Este personaje ya forma parte de tu meta local. Sigue retándolo
                para defenderlo o compara tu sesgo con el ranking global.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-lg font-black text-fg-strong">
                Aún no lo has empujado
              </p>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                Tienes {totalVotes} voto{totalVotes === 1 ? '' : 's'} en tu ranking local,
                pero ninguno para {personaje.nombre}.
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent px-3.5 py-2 text-[12px] font-black text-white transition-colors hover:bg-accent-hover"
          >
            <Swords className="h-3.5 w-3.5" />
            Retarlo
          </Link>
          <Link
            to="/mi-ranking"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-bg/45 px-3.5 py-2 text-[12px] font-black text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
          >
            Ver mi ranking
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to={`/mi-top5?add=${encodeURIComponent(personaje.slug)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent-soft px-3.5 py-2 text-[12px] font-black text-fg-strong transition-colors hover:border-accent hover:text-gold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Llevar a mi Top 5
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function getDuelosPopulares(personaje) {
  const usados = new Set([personaje.slug])
  const mismos = personajes
    .filter((p) => p.anime === personaje.anime && !usados.has(p.slug))
    .sort((a, b) => getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo)
  const globales = [...personajes]
    .filter((p) => p.anime !== personaje.anime && !usados.has(p.slug))
    .sort((a, b) => getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo)

  const out = []
  for (const candidato of [...mismos, ...globales]) {
    if (usados.has(candidato.slug)) continue
    usados.add(candidato.slug)
    out.push(candidato)
    if (out.length >= 6) break
  }
  return out
}

/**
 * Carrusel de personajes recomendados cross-anime.
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
            <Sparkles className="h-3 w-3 text-gold" />
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-accent hover:text-gold"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll(1)}
            aria-label="Siguiente"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-accent hover:text-gold"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        aria-label={`Recomendaciones si te gusta ${nombre}`}
        className="scrollbar-hide scroll-x-affordance scroll-x-fade -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 scroll-smooth sm:-mx-8 sm:px-8"
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
 *
 * <p>Galería: imagenUrl viene del state externo
 * `imagenActiva` para que PersonajeGaleria pueda cambiarla; el slug se
 * mantiene como prop separada porque Personaje3D lo necesita para cargar
 * el modelo lazy con sus propios assets.
 */
function PersonajeStaticOr3D({ imagenUrl, fallbackUrl, slug, nombre }) {
  const [show3D, setShow3D] = useState(false)
  const preload3D = useCallback(() => {
    preloadPersonaje3DOnIdle()
  }, [])

  if (!show3D) {
    return (
      <div className="relative h-full w-full">
        {/* Holo: la imagen del personaje (cards SSR
            del catálogo) se renderiza con efecto Pokémon-TCG-style
            (tilt 3D + specular shine + rainbow holo). PersonajeCardHolo
            es zero-lib y respeta prefers-reduced-motion. */}
        <PersonajeCardHolo src={imagenUrl} alt={nombre} fallbackSrc={fallbackUrl} />
        <button
          type="button"
          onFocus={preload3D}
          onPointerEnter={preload3D}
          onClick={() => setShow3D(true)}
          aria-label={`Abrir vista 3D rotable de ${nombre}`}
          title="Vista 3D rotable del personaje"
          className="group absolute bottom-3 right-3 z-10 inline-flex min-h-11 items-center rounded-full border border-border bg-surface/85 px-4 text-xs font-semibold text-fg-strong backdrop-blur transition-colors hover:border-accent hover:text-gold"
        >
          <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-48 rounded-lg border border-border bg-bg/95 px-3 py-2 text-left text-[12px] leading-snug text-fg-muted shadow-2xl group-hover:block group-focus-visible:block">
            Vista 360° rotable. Se carga solo al abrirla.
          </span>
          Ver en 3D
        </button>
      </div>
    )
  }
  // Modo 3D activo: incluimos el chunk lazy del modelo + toggle para volver
  // a la imagen estática sin recargar la página.
  return (
    <div className="relative h-full w-full">
      <Suspense
        fallback={
          <PersonajeImg
            slug={slug}
            src={fallbackUrl || imagenUrl}
            alt={nombre}
            loading="eager"
            sizes="(min-width: 1024px) 520px, 90vw"
            className="h-full w-full object-cover"
          />
        }
      >
        <Personaje3D slug={slug} />
      </Suspense>
      <button
        type="button"
        onClick={() => setShow3D(false)}
        className="absolute bottom-3 right-3 z-10 inline-flex min-h-11 items-center rounded-full border border-accent/60 bg-bg/85 px-4 text-xs font-semibold text-gold backdrop-blur transition-colors hover:border-accent hover:bg-accent/15"
      >
        Volver a imagen
      </button>
    </div>
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
          accent ? 'text-gold' : 'text-fg-strong'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default PersonajeDetailPage
