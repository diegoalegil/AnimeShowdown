import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BarChart3,
  CalendarDays,
  Image as ImageIcon,
  Share2,
  Swords,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { useAuth } from '../contexts/AuthContext'
import { endpoints } from '../lib/api'
import {
  clearLocalVotes,
  getLocalVoteStats,
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'
import { recordDailyShare } from '../lib/dailyProgress'
import { shareOrCopy } from '../lib/share'
import PersonalDossier from '../features/miRanking/PersonalDossier'
import { dossierStorage } from '../features/miRanking/dossierStorage'
import {
  buildDossierEntries,
  buildGlobalRankMap,
  computeRecentVoteSlug,
} from '../features/miRanking/dossier-data'

// Re-entradas en la misma sesión (back-nav): el expediente no repite la
// ceremonia del sello.
const DOSSIER_SEEN_KEY = 'animeshowdown.mi-ranking.entered'

/**
 * /mi-ranking — «El archivo de <username>»: el ranking personal local
 * como expediente del usuario (PersonalDossier). Las placas comparan
 * contra el snapshot de la última visita (cintas ▲▼), contrastan con la
 * posición global (toggle persistente) y el voto recién emitido late al
 * volver de /votar.
 *
 * Nota de producto: el banzuke personal es ALL-TIME POR DISEÑO. El filtro
 * por periodo (Hoy/7d) del diseño anterior se retiró; la recencia se aborda
 * ahora por DOS vías distintas y complementarias —las cintas ▲▼ comparan
 * contra la última visita (movimiento personal) y "Últimos votos" es el log
 * cronológico— pero NINGUNA reintroduce la vista filtrada por ventana
 * temporal. Si producto la quiere de vuelta, es una decisión aparte.
 */
function MiRankingPage() {
  useSeo({
    title: 'Mi ranking anime',
    description:
      'Ranking personal local de AnimeShowdown basado en los personajes que más votas. Comparte tu top y reta a tus favoritos.',
    canonical: 'https://animeshowdown.dev/mi-ranking',
    noindex: true,
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const { user } = useAuth()
  const [votes, setVotes] = useState(() => readLocalVotes())

  useEffect(
    () => listenLocalVotes((nextVotes) => setVotes(nextVotes)),
    [],
  )

  const catalogBySlug = useMemo(
    () => new Map(catalogoPersonajes.map((personaje) => [personaje.slug, personaje])),
    [catalogoPersonajes],
  )
  const stats = useMemo(() => getLocalVoteStats(votes), [votes])

  // Posición global por slug: la misma query/cache del Pulso de la home.
  const { data: globalRanking } = useQuery({
    queryKey: ['pulso', 'ranking'],
    queryFn: endpoints.ranking,
    staleTime: 60 * 1000,
  })
  const globalBySlug = useMemo(
    () => buildGlobalRankMap(globalRanking),
    [globalRanking],
  )

  const entries = useMemo(
    () => buildDossierEntries(stats.top, catalogBySlug, globalBySlug),
    [stats.top, catalogBySlug, globalBySlug],
  )

  // Voto reciente (vuelta de /votar) + marca de sesión para skipEntrance.
  // Lecturas dentro de rAF en el mount: mismo patrón Compiler-safe que el
  // propio dossier (cero setState síncrono en cuerpo de effect).
  const [recentVoteSlug, setRecentVoteSlug] = useState(null)
  const [skipEntrance] = useState(() => {
    try {
      return sessionStorage.getItem(DOSSIER_SEEN_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setRecentVoteSlug(computeRecentVoteSlug(readLocalVotes(), Date.now()))
      try {
        sessionStorage.setItem(DOSSIER_SEEN_KEY, '1')
      } catch {
        // ignore
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const top = useMemo(
    () =>
      stats.top.map((item) => ({
        ...item,
        personaje: catalogBySlug.get(item.slug) || null,
      })),
    [catalogBySlug, stats.top],
  )
  const topTwo = top.slice(0, 2)

  const compartir = async () => {
    const podium = top.slice(0, 5)
    const text = podium.length
      ? [
          'Mi ranking personal de AnimeShowdown:',
          ...podium.map((item, index) => `${index + 1}. ${item.nombre} x${item.count}`),
          `Total: ${stats.total} voto${stats.total === 1 ? '' : 's'} registrados en este navegador.`,
        ].join('\n')
      : 'Estoy creando mi ranking personal de personajes anime en AnimeShowdown. ¿Cuál sería tu top?'
    try {
      const result = await shareOrCopy({
        title: 'Mi ranking anime',
        text,
        url: '/mi-ranking',
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Ranking compartido' : 'Ranking copiado')
    } catch (error) {
      toast.error('No se pudo compartir', {
        description: error?.message || 'Copia el resultado manualmente.',
      })
    }
  }

  const reiniciar = () => {
    if (stats.total > 0 && !window.confirm('¿Reiniciar tu ranking personal local?')) return
    clearLocalVotes()
    toast.success('Ranking personal reiniciado')
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.ranking}
      className="py-10 sm:py-12"
      lateralKanji={{ left: '私', right: '順' }}
      atmosphere="archive"
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Mi ranking', path: '/mi-ranking' },
        ])}
      />
      <JsonLd id="mi-ranking-page" schema={miRankingSchema()} />

      <div className="mx-auto max-w-4xl">
        <PersonalDossier
          username={user?.username ?? 'invitado'}
          entries={entries}
          storage={dossierStorage}
          recentVoteSlug={recentVoteSlug}
          skipEntrance={skipEntrance}
        />

        {entries.length > 0 ? (
          <>
            <section
              aria-label="Acciones del archivo"
              className="mt-6 flex flex-wrap gap-2"
            >
              <Link
                to="/votar"
                className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
              >
                <Swords className="h-4 w-4" />
                Votar para moverlo
              </Link>
              <button
                type="button"
                onClick={compartir}
                className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <Share2 className="h-4 w-4" />
                Compartir top
              </button>
              <Link
                to="/mi-top5"
                className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <ImageIcon className="h-4 w-4" />
                Crear imagen
              </Link>
              {topTwo.length === 2 && (
                <Link
                  to={`/comparar?a=${encodeURIComponent(topTwo[0].slug)}&b=${encodeURIComponent(topTwo[1].slug)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-[12px] font-bold text-gold transition-colors hover:bg-accent/20"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Comparar mi top 2
                </Link>
              )}
              <button
                type="button"
                onClick={reiniciar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/50 px-3 py-2 text-[12px] font-bold text-fg-muted transition-colors hover:border-danger/45 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reiniciar
              </button>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Detalle del archivo">
              <SummaryPanel stats={stats} />
              <AnimePanel animes={stats.animes} />
              <LatestVotes votes={stats.latest} />
            </section>
          </>
        ) : null}
      </div>
    </VisualPageShell>
  )
}

function SummaryPanel({ stats }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-black text-gold">
        Resumen
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat icon={Swords} value={stats.total} label="votos" />
        <MiniStat icon={UserRound} value={stats.uniqueCharacters} label="chars" />
        <MiniStat icon={CalendarDays} value={stats.uniqueAnimes} label="animes" />
      </div>
    </section>
  )
}

function MiniStat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-lg border border-border bg-bg/45 p-3">
      <Icon className="mx-auto mb-1 h-4 w-4 text-gold" />
      <p className="font-mono text-lg font-black text-fg-strong">{value}</p>
      <p className="text-[10px] text-fg-muted">{label}</p>
    </div>
  )
}

function AnimePanel({ animes }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-black text-gold">
        Universos que más empujas
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {animes.slice(0, 5).map((item) => (
          <div key={item.anime} className="flex items-center justify-between gap-3 text-sm">
            <span className="line-clamp-1 text-fg-muted">{item.anime}</span>
            <span className="font-mono font-black text-fg-strong">{item.count}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function LatestVotes({ votes }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-black text-gold">
        Últimos votos
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {votes.slice(0, 6).map((vote) => (
          <div key={vote.id} className="rounded-lg border border-border bg-bg/45 px-3 py-2">
            <p className="line-clamp-1 text-[13px] font-bold text-fg-strong">
              {vote.ganadorNombre}
            </p>
            <p className="line-clamp-1 text-[11px] text-fg-muted">
              contra {vote.perdedorNombre || 'rival'} · {formatDate(vote.at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'ahora'
  }
}

function miRankingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Mi ranking anime',
    url: 'https://animeshowdown.dev/mi-ranking',
    description:
      'Ranking personal local de AnimeShowdown basado en los personajes anime que más vota cada usuario.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev/',
    },
  }
}

export default MiRankingPage
