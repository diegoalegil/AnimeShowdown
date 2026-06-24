import { lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  Share2,
  Sparkles,
  Scale,
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
  getPopularidad,
  getStatsPersonaje,
  canonicalPersonajeSlug,
} from '../lib/personajes-core'
import { useSeo } from '../hooks/useSeo'
import { buscarPersonajeJikan } from '../lib/jikan'
import { citaPersonaje } from '../lib/animechan'
import { personajeSchema, breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import EloHistoryChart from '../components/EloHistoryChart'
import HistorialCompetitivo from '../components/HistorialCompetitivo'
import PersonajeCard from '../components/PersonajeCard'
import CardFlip from '../components/CardFlip'
import PersonajeCardBack from '../components/PersonajeCardBack'
import PersonajeCardHolo from '../components/PersonajeCardHolo'
import ExhibitStand from '../components/ExhibitStand'
import ByobuGallery from '../components/ByobuGallery'
import QuoteScroll from '../components/QuoteScroll'
import PersonajeImg from '../components/PersonajeImg'
import {
  MarcoExpediente,
  PlacaElo,
  PinceladaWinRate,
} from '../features/personajes/fighter-dossier'
import ReactionsBar from '../components/ReactionsBar'
import SeguirPersonajeButton from '../components/SeguirPersonajeButton'
import ShareButtons from '../components/ShareButtons'
import ComentariosPersonaje from '../components/ComentariosPersonaje'
import { usePersonajesSimilares } from '../hooks/usePersonajesSimilares'
import { useImagenesPersonaje } from '../hooks/useImagenesPersonaje'
import { useVotosPeriodo } from '../hooks/useVotosPeriodo'
import { endpoints, ApiError } from '../lib/api'
import { useSound } from '../contexts/SoundContext'
import FighterCodex from '../features/personajes/codex/FighterCodex'
import NotFoundPage from './NotFoundPage'
import { VisualPageShell } from '../components/VisualSystem'
import { hexToRgbChannels } from '../lib/color'
import { getAnimeVisual } from '../data/anime-visual'
import { slugifyAnime } from '../lib/animes'
import { shareWithToast } from '../lib/shareWithToast'
import {
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'
import RetoRecomendado from '../features/personajes/components/RetoRecomendado'
import { getRetoRecomendado } from '../features/personajes/reto-recomendado'
import { buildPersonajeDetailContext } from '../features/personajes/personaje-detail-data'
import { getCategoriasPersonaje, CATEGORIAS } from '../data/personajes-tags'

const loadPersonaje3D = () => import('../components/Personaje3D')
const Personaje3D = lazy(loadPersonaje3D)

function canCreateWebGLContext() {
  if (typeof document === 'undefined') return false

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.()
    return Boolean(gl)
  } catch {
    return false
  }
}

// El contenedor solo orquesta el stagger; el fade por bloque vive en
// itemVariants. Sin opacity propia: durante el morph de navegación el hero
// se captura sin efectos de ancestro y un fade del article entero
// reaparecería como parpadeo justo al terminar la transición.
const containerVariants = {
  hidden: {},
  visible: {
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
  // undefined = pendiente (se reserva sitio con skeleton para que la ficha
  // no pegue saltos al llegar el fetch), null = resuelto sin dato (el hueco
  // se colapsa una sola vez), objeto = dato real.
  const [jikan, setJikan] = useState(undefined)
  const [cita, setCita] = useState(undefined)
  // Imagen mostrada en el hero. Default = imagen del catálogo (la galería
  // que permitía cambiarla se retiró; el state se conserva por el reset).
  // Reset al cambiar de slug usando el patrón "storing info from previous
  // renders" de React docs — evita el anti-patrón useEffect+setState que
  // dispara un render extra: https://react.dev/reference/react/useState
  const imagenCatalogo = personaje ? imagenPersonaje(slug) : null
  const [imagenActiva, setImagenActiva] = useState(imagenCatalogo)
  const [slugAnterior, setSlugAnterior] = useState(slug)
  if (slug !== slugAnterior) {
    setSlugAnterior(slug)
    setImagenActiva(imagenCatalogo)
    // Volver a pendiente: si no, la cita y los datos MAL del personaje
    // ANTERIOR se quedan visibles en la ficha nueva hasta que respondan
    // los fetches.
    setJikan(undefined)
    setCita(undefined)
  }

  // Galería de láminas oficiales (Jikan/MAL): el hook y el backend ya existían
  // sin consumir. Lista de URLs (string[]); ByobuGallery espera { url } por
  // lámina, así que se adapta la forma. No toca `imagenActiva` ni el hero: es
  // una sección aditiva con su propio visor.
  const { data: imagenesGaleria, isLoading: galeriaLoading } =
    useImagenesPersonaje(slug)
  // Sonido del kakejiku de la cita (respeta el mute global vía SoundContext).
  const { play } = useSound()

  useEffect(() => {
    if (!personaje) return
    let cancelado = false
    buscarPersonajeJikan(personaje.nombre, personaje.anime).then((d) => {
      if (!cancelado) setJikan(d ?? null)
    })
    citaPersonaje(personaje.nombre).then((q) => {
      if (!cancelado) setCita(q ?? null)
    })
    return () => {
      cancelado = true
    }
  }, [personaje])

  const personajeBackendId = personaje && Number.isFinite(Number(personaje.id))
    ? Number(personaje.id)
    : null

  const [localVotes, setLocalVotes] = useState(() => readLocalVotes())
  useEffect(
    () => listenLocalVotes((nextVotes) => setLocalVotes(nextVotes)),
    [],
  )
  const navigate = useNavigate()
  // Datos de los pliegos del FighterCodex (la cabecera-libro). Todos públicos
  // y honestos: si el backend no responde, el pliego correspondiente pinta su
  // estado vacío (río seco 空 / páginas en blanco / sin votos) — nunca inventa.
  //   - río de tinta (InkRiver): serie de votos acumulados de /elo-history,
  //     remapeada a la clave `votos` que el componente espera.
  //   - páginas enfrentadas (FacingPages): agregado /matchups (rival/wins/losses).
  //   - pliego de votos: useVotosPeriodo (mismo hook que el historial competitivo).
  const { data: eloHistory } = useQuery({
    queryKey: ['personaje', slug, 'elo-history', 30],
    queryFn: () => endpoints.personajeEloHistory(slug, { dias: 30 }),
    enabled: Boolean(personaje),
    staleTime: 30 * 60_000,
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 1,
  })
  const codexHistorial = useMemo(
    () =>
      Array.isArray(eloHistory)
        ? eloHistory.map((p) => ({ fecha: p.fecha, votos: p.votosAcumulados }))
        : [],
    [eloHistory],
  )
  const { data: matchups } = useQuery({
    queryKey: ['personaje', slug, 'matchups'],
    queryFn: () => endpoints.matchupsPersonaje(slug),
    enabled: Boolean(personaje),
    staleTime: 60 * 1000,
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 1,
  })
  // matchups es un DTO-objeto (MatchupResumenDto), NO un array: Array.isArray()
  // siempre era false, así que el pliego 対 mostraba un "páginas en blanco"
  // falso. Normalizamos a rivalesFrecuentes (rival, wins, losses) y gateamos
  // por total (como HistorialCompetitivo) para no surfacing rivalidades de 1
  // duelo.
  const codexMatchups = useMemo(
    () =>
      (matchups?.totalEnfrentamientos ?? 0) >= 3
        ? matchups?.rivalesFrecuentes ?? []
        : [],
    [matchups],
  )
  const { data: votosPeriodo } = useVotosPeriodo(personaje ? slug : null, {
    dias: 7,
  })
  const personalLocalStats = useMemo(
    () => getLocalVoteStats(localVotes),
    [localVotes],
  )
  // useMemo: buildPersonajeDetailContext ordena el catálogo completo dos veces
  // (rankedGlobal/rankedAnime). Sin memo se re-ordenaba en cada render del padre
  // aunque no cambiara nada relevante.
  // `personajes` es un import de módulo estable (nunca cambia), pero va en deps
  // para que el React Compiler pueda preservar la memoización; exhaustive-deps lo
  // marca como innecesario (lo es, es inocuo) y se silencia puntualmente.
  const detailContext = useMemo(
    () => buildPersonajeDetailContext({ catalogo: personajes, personaje, slug, idx }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personajes, personaje, slug, idx],
  )

  if (idx !== -1 && slugParam !== slug) {
    return <Navigate to={`/personajes/${slug}`} replace />
  }

  if (idx === -1) return <NotFoundPage />

  const {
    prev,
    next,
    rankGlobal,
    animePersonajes,
    rankAnime,
    relacionados,
    duelosPopulares,
    totalAnime,
  } = detailContext
  const total = stats.wins + stats.losses
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0
  // Categorías otaku curadas (personajes-tags.js): chips clicables que llevan
  // al catálogo ya filtrado por ese rasgo (/personajes?tag=<id>, que la página
  // entiende nativamente). Sin tags curados → no se pinta nada (dato real).
  const categoriasPersonaje = getCategoriasPersonaje(slug)
    .map((id) => CATEGORIAS.find((c) => c.id === id))
    .filter(Boolean)
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
    await shareWithToast(
      {
        title: titulo,
        text: [
          `${personaje.nombre} de ${personaje.anime} está en AnimeShowdown con ELO base ${stats.elo}. ¿Lo subirías en el ranking?`,
          personalLine,
        ].filter(Boolean).join('\n'),
        url: `/personajes/${slug}`,
      },
      {
        nativeSuccess: 'Ficha compartida',
        clipboardSuccess: 'Ficha copiada',
      },
    )
  }
  const retoRecomendado = getRetoRecomendado(personaje)
  // Visual del anime al que pertenece el personaje: usa el banner editorial
  // del universo (naruto.webp, demon-slayer.webp...) como ambient hero
  // detras del shell, en lugar de la as-stage genérica.
  const animeSlug = slugifyAnime(personaje.anime)
  const visualAnime = getAnimeVisual(animeSlug, personaje.anime)
  // Dossier del dorso de la carta (flip "Stats"): SOLO métricas que la ficha
  // ya muestra, con los mismos calificadores "est." — sin inventar datos.
  // La racha de duelos no existe como dato real → no se pasa (sección oculta).
  const popularidad = getPopularidad(slug)
  const dossier = {
    nombre: personaje.nombre,
    anime: personaje.anime,
    subtitulo: `${totalAnime} personajes en su universo`,
    selloKanji: visualAnime?.identity?.kanji ?? visualAnime?.kanji,
    numero: `Nº ${String(idx + 1).padStart(3, '0')}`,
    ejes: [
      { label: 'Popularidad', valor: String(popularidad), pct: popularidad / 100 },
      {
        label: 'ELO base',
        valor: String(stats.elo),
        pct: 1 - (rankGlobal - 1) / Math.max(1, personajes.length),
      },
      { label: 'Win rate est.', valor: `${winRate}%`, pct: winRate / 100 },
      {
        label: 'Rank anime',
        valor: `#${rankAnime}`,
        pct: 1 - (rankAnime - 1) / Math.max(1, totalAnime),
      },
    ],
  }
  const compartirRetoRecomendado = async () => {
    if (!retoRecomendado) return
    const rival = retoRecomendado.personaje
    await shareWithToast(
      {
        title: `${personaje.nombre} vs ${rival.nombre}`,
        text: [
          `Reto recomendado en AnimeShowdown: ${personaje.nombre} vs ${rival.nombre}.`,
          `Diferencia ELO base: ${retoRecomendado.delta} puntos.`,
          '¿A quién subirías votando?',
        ].join('\n'),
        url: `/duelos/${personaje.slug}-vs-${rival.slug}`,
      },
      {
        nativeSuccess: 'Reto compartido',
        clipboardSuccess: 'Reto copiado',
        errorTitle: 'No se pudo compartir el reto',
      },
    )
  }

  return (
    <VisualPageShell
      visual={{
        ...visualAnime,
        // V-1.1: tinte por personaje — el fondo procedural toma el color
        // dominante de la carta; fallback al accent del universo.
        accentRgb: hexToRgbChannels(personaje?.imagenColorDominante) ?? visualAnime?.accentRgb,
      }}
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
        {/* FighterCodex (pieza 124): la cabecera de la ficha como LIBRO ceremonial.
            La cubierta (retrato a sangre) ES el destino del morph compartido
            personaje-hero (el componente hace adopt/release en su propio
            useLayoutEffect → por eso la página ya no lo adopta) y reorganiza el
            cuerpo en PLIEGOS-tabs: Stats 戦, río de tinta 史 (/elo-history),
            páginas enfrentadas 対 (/matchups), votos 炎 (votos-periodo). Carga
            su Microdata schema.org/Person (name H1 + url) y los tres sellos de
            estado (ELO acuñado · puesto global · % victorias). Las secciones
            ricas preexistentes (carta 3D, galería, reacciones, placa ELO,
            descripción, cita, historial competitivo, comentarios…) se conservan
            ÍNTEGRAS debajo, crawlables y con sus mismos hooks/props. */}
        <FighterCodex
          key={`codex-${slug}`}
          personaje={personaje}
          stats={stats}
          rankGlobal={rankGlobal}
          rankAnime={rankAnime}
          totalAnime={totalAnime}
          universoKanji={visualAnime?.identity?.kanji ?? visualAnime?.kanji}
          numero={String(idx + 1).padStart(3, '0')}
          historial={codexHistorial}
          matchups={codexMatchups}
          votosPeriodo={votosPeriodo}
          onRetar={() =>
            navigate(`/votar?personaje=${encodeURIComponent(personaje.slug)}`)
          }
        />
        {/* Detalle y acciones de la ficha: layout preexistente conservado al
            completo (carta 3D + galería + CTAs + reacciones + placa ELO + cita
            + navegación prev/next). Ya NO declara un segundo schema.org/Person:
            la única entidad Person es la del FighterCodex de arriba; aquí el
            contenido sigue siendo texto crawlable y el JSON-LD (intacto) manda
            como dato estructurado. El nombre/furigana dejó de duplicarse: lo
            pinta el frontispicio del códice. */}
        <motion.section
          key={`detalle-${slug}`}
          className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start md:gap-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Columna visual (izquierda en desktop): carta holo + galería +
              figura. A la derecha, la info encabezada por el avatar circular +
              nombre. items-start en el grid evita el espacio muerto que dejaba
              items-center; en móvil la identidad va antes (order-1). */}
          {/* Carta interactiva (3D + dossier flip) y galería: se conservan
              íntegras. El morph compartido personaje-hero ya NO lo adopta esta
              columna — lo hace la cubierta del FighterCodex (.codex__hero) para
              no duplicar el view-transition-name. Esta carta queda como visor
              estático/3D on-demand del retrato. */}
          <div className="order-2 mx-auto flex w-full min-w-0 max-w-sm flex-col md:order-1 md:mx-0 md:max-w-md">
            <div
              className="relative mx-auto aspect-[2/3] max-h-[55vh] w-auto overflow-hidden rounded-2xl border border-border bg-surface md:mx-0 md:w-full md:max-h-none"
              style={{ filter: 'var(--personaje-hero-drop-shadow)' }}
            >
              {/* Personaje3D era opt-in al mount con
                  imagen como fallback, pero el chunk se descargaba siempre
                  al entrar a la ficha y disparaba 'THREE.Clock deprecated'
                  en consola. Cambio a static-first: imagen como default y
                  un botón 'Ver en 3D' monta el lazy chunk on-demand.

                  La imagen del hero es la del state `imagenActiva`
                  (hoy siempre la del catálogo, sin galería).
                  PersonajeStaticOr3D recibe la URL como prop. */}
              <PersonajeStaticOr3D
                imagenUrl={imagenActiva}
                fallbackUrl={imagenCatalogo}
                slug={slug}
                nombre={personaje.nombre}
                dossier={dossier}
              />
              {/* Marco de expediente: esquinas + sello hanko del anime.
                  Overlays estáticos que viajan con el morph del contenedor.
                  Sin kanji real del universo → sin sello (nunca relleno). */}
              <MarcoExpediente
                animeKanji={visualAnime?.identity?.kanji ?? visualAnime?.kanji}
                anime={personaje.anime}
              />
            </div>
            {/* Galería de láminas oficiales (Jikan/MAL) como biombo de
                miniaturas con visor a pantalla. Aditiva: se autocolapsa si el
                personaje no tiene láminas extra; no toca el hero. */}
            <ByobuGallery
              images={(imagenesGaleria ?? []).map((url) => ({ url }))}
              title={personaje.nombre}
              status={galeriaLoading ? 'loading' : 'ready'}
            />
          </div>
          <motion.div
            className="order-1 flex flex-col items-start gap-5 md:order-2"
            variants={containerVariants}
          >
            <motion.div
              className="flex flex-wrap items-center gap-2"
              variants={itemVariants}
            >
              {rankGlobal <= 100 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-medal-gold/40 bg-medal-gold/10 px-3 py-1 text-[11px] font-semibold text-medal-gold"
                  title="Ranking del catálogo según ELO base estimado (popularidad). El ranking competitivo real vive en /ranking."
                >
                  <Trophy className="h-3 w-3" />
                  #{rankGlobal} ELO base
                </span>
              )}
              {animePersonajes.length > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-[11px] font-semibold text-gold">
                  #{rankAnime} de {personaje.anime}
                </span>
              )}
              <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-fg-muted">
                Personaje {idx + 1} de {personajes.length}
              </span>
              {/* Píldora fantasma mientras Jikan responde — la badge real
                  entraba tarde en la fila y la hacía re-envolver (CLS). */}
              {jikan === undefined && (
                <span
                  aria-hidden="true"
                  className="inline-flex h-[26px] w-28 animate-pulse rounded-full border border-border bg-surface motion-reduce:animate-none"
                />
              )}
              {jikan?.favorites != null && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-fg-muted"
                  title="Favoritos contados por MyAnimeList — métrica externa, no del ranking interno de AnimeShowdown"
                >
                  <Star className="h-3 w-3 text-gold" />
                  {jikan.favorites.toLocaleString('es-ES')} fans MAL
                </span>
              )}
            </motion.div>
            {categoriasPersonaje.length > 0 && (
              <motion.div variants={itemVariants} className="w-full">
                <p className="mb-1.5 text-[11px] font-semibold text-fg-muted">
                  Rasgos otaku
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {categoriasPersonaje.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        to={`/personajes?tag=${encodeURIComponent(cat.id)}`}
                        title={`Ver personajes con el rasgo ${cat.label}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:text-gold"
                      >
                        <span aria-hidden="true">{cat.emoji}</span>
                        {cat.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
            {/* La identidad (anime furigana + nombre H1 + hairline) y la
                Microdata schema.org/Person viven ahora en el frontispicio del
                FighterCodex de arriba; no se duplican aquí para no emitir un
                segundo H1/entidad Person. Las acciones siguen intactas. */}
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
                to={`/comparar?a=${encodeURIComponent(personaje.slug)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
              >
                <Scale className="h-4 w-4" />
                Comparar
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
            {/* La placa acuñada y la pincelada llevan su propia entrada CSS
                (cuño t0+100ms, pincelada t0+250ms): div plano, fuera del
                stagger de framer para no doblar la coreografía. El "ELO"
                sigue siendo getStatsPersonaje(slug): base/estimado — la
                placa no lo inventa, y el ranking real vive en /ranking. */}
            <div className="flex w-full flex-col gap-4">
              <PlacaElo elo={stats.elo} puesto={rankGlobal} total={personajes.length} />
              <PinceladaWinRate
                winRate={total > 0 ? winRate : null}
                combates={total}
              />
            </div>
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
                <p className="text-[11px] font-semibold text-fg-muted">
                  Sobre el personaje
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fg">
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
            {/* La cita (animechan) colgada como kakejiku: pergamino vertical
                con varillas y sello, que se desenrolla al entrar al viewport.
                Reserva su altura desde el primer render (sin CLS) y se
                autocolapsa si no hay cita. status: undefined = en vuelo
                (esqueleto), objeto/null = resuelto (QuoteScroll no monta nada
                sin contenido). */}
            <QuoteScroll
              status={cita === undefined ? 'loading' : 'ready'}
              quote={cita ?? null}
              onCue={(cue) => {
                if (cue === 'unroll') play('playWhoosh')
                else if (cue === 'stamp') play('playSello')
              }}
            />
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
                <span className="inline-flex items-center gap-1 text-[10px] text-fg-muted">
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
                <span className="inline-flex items-center gap-1 text-[10px] text-fg-muted">
                  Siguiente
                  <ArrowRight className="h-3 w-3" />
                </span>
                <span className="font-semibold">{next.nombre}</span>
              </Link>
            </motion.div>
          </motion.div>
        </motion.section>

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

        <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-[12px] font-semibold text-fg-muted">
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
          <section
            className="mt-8 rounded-xl border border-accent/25 p-5"
            style={{ background: 'var(--personaje-popular-duels-bg)' }}
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold">
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
                <span className="text-[11px] font-semibold text-fg-muted">
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
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
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
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
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
function PersonajeStaticOr3D({ imagenUrl, fallbackUrl, slug, nombre, dossier }) {
  const [show3D, setShow3D] = useState(false)
  // Flip al dorso "dossier" de la carta (stats reales de la ficha).
  const [showStats, setShowStats] = useState(false)

  const handleOpen3D = () => {
    if (!canCreateWebGLContext()) {
      toast.error('Tu navegador no puede abrir la vista 3D ahora mismo.')
      return
    }
    setShow3D(true)
  }

  return (
    <div className="relative h-full w-full">
      {/* Holo (frente): la imagen del personaje con efecto TCG (tilt 3D +
          specular + rainbow). Dorso: PersonajeCardBack con el radar de
          stats. CardFlip lleva el blindaje Safari (preserve-3d +
          -webkit-backface-visibility en ambas caras). */}
      <CardFlip
        flipped={showStats}
        front={<PersonajeCardHolo src={imagenUrl} alt={nombre} fallbackSrc={fallbackUrl} />}
        back={dossier ? <PersonajeCardBack {...dossier} /> : null}
      />
      {dossier && (
        <button
          type="button"
          onClick={() => setShowStats((v) => !v)}
          aria-pressed={showStats}
          aria-label={showStats ? `Volver a la carta de ${nombre}` : `Ver stats de ${nombre}`}
          className="absolute bottom-3 left-3 z-10 inline-flex min-h-11 items-center rounded-full border border-gold/45 bg-surface/85 px-4 font-mono text-xs font-semibold text-gold backdrop-blur transition-colors hover:bg-gold/10"
        >
          {showStats ? 'Ver carta' : 'Stats'}
        </button>
      )}
      {!showStats && (
        <button
          type="button"
          onClick={handleOpen3D}
          aria-label={`Abrir vista 3D rotable de ${nombre}`}
          title="Vista 3D rotable del personaje"
          className="group absolute bottom-3 right-3 z-10 inline-flex min-h-11 items-center rounded-full border border-border bg-surface/85 px-4 text-xs font-semibold text-fg-strong backdrop-blur transition-colors hover:border-accent hover:text-gold"
        >
          <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden w-48 rounded-lg border border-border bg-bg/95 px-3 py-2 text-left text-[12px] leading-snug text-fg-muted shadow-2xl group-hover:block group-focus-visible:block">
            Vista 360° rotable. Se carga solo al abrirla.
          </span>
          Ver en 3D
        </button>
      )}
      {/* La peana 3D (canvas pieza 113): ExhibitStand monta como MODAL sobre la
          carta. Personaje3D entra como children y el wrapper lleva su propio
          Suspense (antesala 形) + ErrorBoundary que degrada a la imagen
          estática si la textura/WebGL falla. El chunk lazy sigue cargándose
          solo al abrir (la política on-demand no cambia: el guard
          canCreateWebGLContext() de handleOpen3D se mantiene). */}
      {show3D && (
        <ExhibitStand
          open={show3D}
          onClose={() => setShow3D(false)}
          nombre={nombre}
          slug={slug}
          fallbackUrl={fallbackUrl || imagenUrl}
        >
          <Personaje3D slug={slug} />
        </ExhibitStand>
      )}
    </div>
  )
}

export default PersonajeDetailPage
