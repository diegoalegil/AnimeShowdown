import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Flame,
  Share2,
  Swords,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getPersonajeBySlug,
  getPopularidad,
  getStatsPersonaje,
  imagenPersonaje,
  personajes,
} from '../lib/personajes-core'
import { useSeo } from '../hooks/useSeo'
import { toFighter } from '../features/versus/versus-fighter'
import JsonLd from '../components/JsonLd'
import PersonajeImg from '../components/PersonajeImg'
import VersusIntroOverlay from '../features/versus/VersusIntroOverlay'
import NotFoundPage from './NotFoundPage'
import { shareOrCopy } from '../lib/share'
import { recordDailyShare } from '../lib/dailyProgress'
import {
  listenLocalVotes,
  readLocalVotes,
} from '../lib/localVoteRanking'

const SITE = 'https://animeshowdown.dev'

function DueloVersusPage() {
  const { par } = useParams()
  const match = par?.match(/^(.+)-vs-(.+)$/)
  const slugA = match?.[1]
  const slugB = match?.[2]
  const personajeA = slugA ? getPersonajeBySlug(slugA) : null
  const personajeB = slugB ? getPersonajeBySlug(slugB) : null
  const valido = Boolean(personajeA && personajeB && personajeA.slug !== personajeB.slug)
  const canonical = valido ? `${SITE}/versus/${personajeA.slug}-vs-${personajeB.slug}` : undefined
  const ogImage = valido
    ? `/api/og/duelo/${encodeURIComponent(personajeA.slug)}/vs/${encodeURIComponent(personajeB.slug)}.png`
    : undefined
  const [localVotes, setLocalVotes] = useState(() => readLocalVotes())

  useEffect(
    () => listenLocalVotes((nextVotes) => setLocalVotes(nextVotes)),
    [],
  )

  const personalSignal = useMemo(() => {
    if (!valido) {
      return { total: 0, countA: 0, countB: 0, leader: null }
    }
    const countA = localVotes.filter((vote) => vote.ganadorSlug === personajeA.slug).length
    const countB = localVotes.filter((vote) => vote.ganadorSlug === personajeB.slug).length
    return {
      total: countA + countB,
      countA,
      countB,
      leader: countA === countB ? null : countA > countB ? personajeA : personajeB,
    }
  }, [localVotes, personajeA, personajeB, valido])

  useSeo(
    valido
      ? {
          title: `${personajeA.nombre} vs ${personajeB.nombre} — ¿quién ganaría?`,
          description: `Comparativa ELO, votos comunitarios y duelo abierto entre ${personajeA.nombre} (${personajeA.anime}) y ${personajeB.nombre} (${personajeB.anime}) en AnimeShowdown.`,
          canonical,
          image: ogImage,
          type: 'article',
        }
      : { title: '404 — Duelo no encontrado', noindex: true },
  )

  if (!valido) return <NotFoundPage />

  const statsA = getStatsPersonaje(personajeA.slug)
  const statsB = getStatsPersonaje(personajeB.slug)
  const fighterA = toFighter(personajeA)
  const fighterB = toFighter(personajeB)
  const ganadorTeorico = statsA.elo >= statsB.elo ? personajeA : personajeB
  const diferenciaElo = Math.abs(statsA.elo - statsB.elo)
  const sugerenciasA = getSugerenciasDuelo(personajeA, personajeB.slug)
  const sugerenciasB = getSugerenciasDuelo(personajeB, personajeA.slug)
  const votarDueloUrl = `/votar?personaje=${encodeURIComponent(personajeA.slug)}&rival=${encodeURIComponent(personajeB.slug)}`
  const compartirDuelo = async () => {
    try {
      const personalLine =
        personalSignal.total > 0
          ? personalSignal.leader
            ? `En mi ranking local voy más con ${personalSignal.leader.nombre}: ${personalSignal.countA}-${personalSignal.countB}.`
            : `En mi ranking local van empatados: ${personalSignal.countA}-${personalSignal.countB}.`
          : null
      const result = await shareOrCopy({
        title: `${personajeA.nombre} vs ${personajeB.nombre}`,
        text: [
          `${personajeA.nombre} vs ${personajeB.nombre} en AnimeShowdown.`,
          `${ganadorTeorico.nombre} llega con ventaja ELO de ${diferenciaElo} puntos.`,
          personalLine,
          '¿A quién subirías votando?',
        ]
          .filter(Boolean)
          .join('\n'),
        url: `/versus/${personajeA.slug}-vs-${personajeB.slug}`,
      })
      if (result === 'cancelled') return
      recordDailyShare()
      toast.success(result === 'native' ? 'Duelo compartido' : 'Duelo copiado')
    } catch (error) {
      toast.error('No se pudo compartir el duelo', {
        description: error?.message || 'Copia el enlace manualmente.',
      })
    }
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <VersusIntroOverlay
        left={fighterA}
        right={fighterB}
        storageKey={`vs-intro:${personajeA.slug}-vs-${personajeB.slug}`}
      />
      <JsonLd id="duelo-versus" schema={dueloSchema(personajeA, personajeB, canonical)} />
      <div className="mx-auto max-w-6xl">
        <Link
          to="/personajes"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>

        <div className="mb-8 flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-[11px] font-semibold text-gold">
            <Swords className="h-3.5 w-3.5" />
            Duelo abierto
          </span>
          <div className="max-w-4xl">
            <h1 className="text-[clamp(2.25rem,6vw,4.8rem)] font-black leading-[0.95] tracking-tight text-fg-strong">
              {personajeA.nombre} vs {personajeB.nombre}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
              Comparativa rápida de ELO, récord local y popularidad para decidir
              qué personaje llega con más momentum al enfrentamiento.
            </p>
          </div>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <VersusHeroCard personaje={personajeA} stats={statsA} side="left" />
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-lg font-black text-gold shadow-aura">
              VS
            </div>
          </div>
          <VersusHeroCard personaje={personajeB} stats={statsB} side="right" />
        </div>

        <PersonalDuelSignal
          a={personajeA}
          b={personajeB}
          signal={personalSignal}
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-bold text-fg-strong">Comparativa</h2>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <ComparativaRow
                label="ELO"
                a={statsA.elo}
                b={statsB.elo}
                winner={statsA.elo === statsB.elo ? null : statsA.elo > statsB.elo ? 'a' : 'b'}
              />
              <ComparativaRow label="Anime" a={personajeA.anime} b={personajeB.anime} />
              <ComparativaRow
                label="Win rate local"
                a={`${getWinRate(statsA)}%`}
                b={`${getWinRate(statsB)}%`}
                winner={getWinRate(statsA) === getWinRate(statsB) ? null : getWinRate(statsA) > getWinRate(statsB) ? 'a' : 'b'}
              />
              <ComparativaRow
                label="Popularidad MAL"
                a={`${getPopularidad(personajeA.slug)}/100`}
                b={`${getPopularidad(personajeB.slug)}/100`}
                winner={
                  getPopularidad(personajeA.slug) === getPopularidad(personajeB.slug)
                    ? null
                    : getPopularidad(personajeA.slug) > getPopularidad(personajeB.slug)
                      ? 'a'
                      : 'b'
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-accent/30 bg-[linear-gradient(135deg,rgb(159_29_44_/_0.14),rgb(255_199_44_/_0.08),rgb(20_20_30_/_0.92))] p-5">
            <div className="flex items-center gap-2 text-gold">
              <Trophy className="h-4 w-4" />
              <p className="text-[11px] font-semibold">
                Quién ganaría según la comunidad
              </p>
            </div>
            <h2 className="mt-4 text-2xl font-black leading-tight text-fg-strong">
              {ganadorTeorico.nombre} llega con ventaja ELO.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fg">
              Diferencia actual: <strong className="text-fg-strong">{diferenciaElo} puntos</strong>.
              El voto real de la comunidad puede cambiar el guion en cualquier momento.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={votarDueloUrl}
                className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4 shrink-0" />
                <span className="truncate">Votar este duelo</span>
              </Link>
              <Link
                to={`/votar?personaje=${encodeURIComponent(personajeA.slug)}`}
                className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
              >
                <Swords className="h-4 w-4 shrink-0" />
                <span className="truncate">Retar a {personajeA.nombre}</span>
              </Link>
              <Link
                to={`/votar?personaje=${encodeURIComponent(personajeB.slug)}`}
                className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
              >
                <Swords className="h-4 w-4 shrink-0" />
                <span className="truncate">Retar a {personajeB.nombre}</span>
              </Link>
              <button
                type="button"
                onClick={compartirDuelo}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-accent hover:text-gold"
              >
                <Share2 className="h-4 w-4" />
                Compartir duelo
              </button>
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-gold" />
            <h2 className="text-lg font-bold text-fg-strong">Más duelos populares</h2>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <DuelosSugeridos personaje={personajeA} sugerencias={sugerenciasA} />
            <DuelosSugeridos personaje={personajeB} sugerencias={sugerenciasB} />
          </div>
        </section>
      </div>
    </section>
  )
}

function PersonalDuelSignal({ a, b, signal }) {
  const total = signal.total
  const tied = total > 0 && signal.countA === signal.countB
  const title =
    total === 0
      ? 'Tu historial local aún no ha tomado partido'
      : tied
        ? 'Tu ranking local va empatado'
        : `Tu ranking local favorece a ${signal.leader.nombre}`

  return (
    <section className="mt-6 rounded-xl border border-gold/30 bg-gradient-to-br from-gold/[0.12] via-surface to-accent/[0.08] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
            <Flame className="h-3.5 w-3.5" />
            Tu sesgo local
          </p>
          <h2 className="mt-1 text-xl font-black text-fg-strong">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-muted">
            {total === 0
              ? 'Vota duelos con cualquiera de estos personajes y esta comparativa empezará a reflejar a quién estás defendiendo tú.'
              : `Este navegador registra ${total} voto${total === 1 ? '' : 's'} local${total === 1 ? '' : 'es'} repartido${total === 1 ? '' : 's'} entre ambos.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LocalVotePill
            personaje={a}
            count={signal.countA}
            highlighted={signal.leader?.slug === a.slug}
          />
          <LocalVotePill
            personaje={b}
            count={signal.countB}
            highlighted={signal.leader?.slug === b.slug}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/mi-ranking"
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-gold/35 bg-gold-soft px-4 py-2 text-sm font-bold text-gold transition-colors hover:bg-gold/10"
        >
          <span className="truncate">Ver mi ranking</span>
        </Link>
        <Link
          to={`/votar?personaje=${encodeURIComponent(signal.leader?.slug || a.slug)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-bold text-gold transition-colors hover:bg-accent/20"
        >
          <Swords className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {signal.leader ? `Defender a ${signal.leader.nombre}` : `Retar a ${a.nombre}`}
          </span>
        </Link>
      </div>
    </section>
  )
}

function LocalVotePill({ personaje, count, highlighted }) {
  return (
    <div
      className={`min-w-32 rounded-lg border px-3 py-2 ${
        highlighted
          ? 'border-gold/45 bg-gold-soft text-gold'
          : 'border-border bg-bg/45 text-fg-strong'
      }`}
    >
      <p className="line-clamp-1 text-[12px] font-black">{personaje.nombre}</p>
      <p className="mt-0.5 font-mono text-xl font-black">{count}</p>
      <p className="text-[10px] text-fg-muted">votos tuyos</p>
    </div>
  )
}

function VersusHeroCard({ personaje, stats, side }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgb(159_29_44_/_0.18),transparent_45%),linear-gradient(180deg,rgb(255_255_255_/_0.04),transparent)]" />
      <div className="relative grid gap-5 p-5 sm:grid-cols-[170px_1fr] sm:p-6">
        <div className={`mx-auto aspect-[2/3] w-full max-w-[210px] overflow-hidden rounded-xl border border-border bg-bg ${side === 'right' ? 'sm:order-2' : ''}`}>
          <PersonajeImg
            slug={personaje.slug}
            alt={personaje.nombre}
            className="h-full w-full object-cover"
            sizes="(min-width: 1024px) 210px, 55vw"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-[11px] font-semibold text-fg-muted">
            {personaje.anime}
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-fg-strong">
            {personaje.nombre}
          </h2>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat label="ELO" value={stats.elo} accent />
            <MiniStat label="Récord" value={`${stats.wins}-${stats.losses}`} />
            <MiniStat label="Ratio" value={`${getWinRate(stats)}%`} />
          </div>
          <Link
            to={`/personajes/${personaje.slug}`}
            className="mt-5 text-sm font-semibold text-gold hover:underline"
          >
            Ver ficha →
          </Link>
        </div>
      </div>
    </article>
  )
}

function ComparativaRow({ label, a, b, winner }) {
  return (
    <div className="grid grid-cols-[1fr_110px_1fr] border-b border-border last:border-b-0">
      <div className={`min-w-0 px-4 py-3 text-sm font-semibold ${winner === 'a' ? 'text-gold' : 'text-fg-strong'}`}>
        {a}
      </div>
      <div className="border-x border-border bg-bg/40 px-3 py-3 text-center text-[11px] font-semibold text-fg-muted">
        {label}
      </div>
      <div className={`min-w-0 px-4 py-3 text-right text-sm font-semibold ${winner === 'b' ? 'text-gold' : 'text-fg-strong'}`}>
        {b}
      </div>
    </div>
  )
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border bg-bg/55 px-3 py-2">
      <p className="text-[9px] font-semibold text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-black ${accent ? 'text-gold' : 'text-fg-strong'}`}>
        {value}
      </p>
    </div>
  )
}

function DuelosSugeridos({ personaje, sugerencias }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold text-fg-muted">
        Más duelos con {personaje.nombre}
      </p>
      <div className="grid gap-2">
        {sugerencias.map((otro) => (
          <Link
            key={otro.slug}
            to={`/duelos/${personaje.slug}-vs-${otro.slug}`}
            className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/45 p-2.5 transition-colors hover:border-accent/50 hover:bg-accent-soft"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
                <PersonajeImg
                  slug={otro.slug}
                  alt={otro.nombre}
                  className="h-full w-full object-cover"
                  sizes="40px"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-fg-strong">
                  {otro.nombre}
                </span>
                <span className="block truncate text-[12px] text-fg-muted">
                  {otro.anime}
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function getWinRate(stats) {
  const total = stats.wins + stats.losses
  return total > 0 ? Math.round((stats.wins / total) * 100) : 0
}

function getSugerenciasDuelo(personaje, excluirSlug) {
  const usados = new Set([personaje.slug, excluirSlug])
  const sameAnime = personajes
    .filter((p) => p.anime === personaje.anime && !usados.has(p.slug))
    .sort((a, b) => getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo)
  const globales = [...personajes]
    .filter((p) => !usados.has(p.slug) && p.anime !== personaje.anime)
    .sort((a, b) => {
      const diff = getPopularidad(b.slug) - getPopularidad(a.slug)
      return diff || getStatsPersonaje(b.slug).elo - getStatsPersonaje(a.slug).elo
    })

  const out = []
  for (const candidato of [...sameAnime, ...globales]) {
    if (usados.has(candidato.slug)) continue
    usados.add(candidato.slug)
    out.push(candidato)
    if (out.length >= 5) break
  }
  return out
}

function dueloSchema(a, b, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${a.nombre} vs ${b.nombre}`,
    description: `Duelo comparativo entre ${a.nombre} de ${a.anime} y ${b.nombre} de ${b.anime} en AnimeShowdown.`,
    url: canonical,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'VirtualLocation',
      url: canonical,
    },
    organizer: {
      '@type': 'Organization',
      name: 'AnimeShowdown',
      url: SITE,
    },
    competitor: [a, b].map((p) => ({
      '@type': 'Person',
      name: p.nombre,
      image: `${SITE}${imagenPersonaje(p.slug)}`,
      url: `${SITE}/personajes/${p.slug}`,
      memberOf: {
        '@type': 'TVSeries',
        name: p.anime,
      },
    })),
  }
}

export default DueloVersusPage
