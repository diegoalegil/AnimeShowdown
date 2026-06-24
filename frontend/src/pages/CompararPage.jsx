import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  RefreshCw,
  Share2,
  Shuffle,
  Swords,
  Trophy,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import AutocompletePersonaje from '../components/AutocompletePersonaje'
import PersonajeImg from '../components/PersonajeImg'
import TaleOfTheTape from '../features/comparar/TaleOfTheTape'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { getStatsPersonaje } from '../lib/personajes-core'
import { shareWithToast } from '../lib/shareWithToast'

function CompararPage() {
  useSeo({
    title: 'Comparar personajes anime',
    description:
      'Compara dos personajes anime en AnimeShowdown, revisa ELO base, récord estimado y abre un duelo compartible.',
    canonical: 'https://animeshowdown.dev/comparar',
    image: BRAND_VISUALS.ranking.image,
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const slugA = searchParams.get('a') || ''
  const slugB = searchParams.get('b') || ''
  const personajeA = useMemo(
    () => catalogoPersonajes.find((p) => p.slug === slugA) ?? null,
    [catalogoPersonajes, slugA],
  )
  const personajeB = useMemo(
    () => catalogoPersonajes.find((p) => p.slug === slugB) ?? null,
    [catalogoPersonajes, slugB],
  )
  const statsA = personajeA ? getStatsPersonaje(personajeA.slug) : null
  const statsB = personajeB ? getStatsPersonaje(personajeB.slug) : null
  const ambos = personajeA && personajeB && personajeA.slug !== personajeB.slug
  const dueloUrl = ambos ? `/duelos/${personajeA.slug}-vs-${personajeB.slug}` : ''
  const ganadorBase =
    ambos && statsA && statsB
      ? statsA.elo >= statsB.elo
        ? personajeA
        : personajeB
      : null
  const diferencia = ambos && statsA && statsB ? Math.abs(statsA.elo - statsB.elo) : 0

  const setSlot = (slot, slug) => {
    const next = new URLSearchParams(searchParams)
    if (slug) next.set(slot, slug)
    else next.delete(slot)
    setSearchParams(next, { replace: true })
  }

  const elegirAleatorio = () => {
    if (catalogoPersonajes.length < 2) return
    const first = catalogoPersonajes[Math.floor(Math.random() * catalogoPersonajes.length)]
    let second = catalogoPersonajes[Math.floor(Math.random() * catalogoPersonajes.length)]
    let guard = 0
    while (second.slug === first.slug && guard < 10) {
      second = catalogoPersonajes[Math.floor(Math.random() * catalogoPersonajes.length)]
      guard += 1
    }
    const next = new URLSearchParams()
    next.set('a', first.slug)
    next.set('b', second.slug)
    setSearchParams(next, { replace: true })
  }

  const equilibrarRival = () => {
    const base = personajeA ?? personajeB
    if (!base) {
      elegirAleatorio()
      return
    }
    const baseStats = getStatsPersonaje(base.slug)
    const rival = catalogoPersonajes
      .filter((p) => p.slug !== base.slug)
      .map((p) => ({ personaje: p, delta: Math.abs(getStatsPersonaje(p.slug).elo - baseStats.elo) }))
      .sort((x, y) => x.delta - y.delta)[0]?.personaje
    if (!rival) return
    const next = new URLSearchParams()
    next.set('a', base.slug)
    next.set('b', rival.slug)
    setSearchParams(next, { replace: true })
  }

  const compartir = async () => {
    if (!ambos) return
    await shareWithToast(
      {
        title: `${personajeA.nombre} vs ${personajeB.nombre}`,
        text: [
          `${personajeA.nombre} vs ${personajeB.nombre} en AnimeShowdown.`,
          `${ganadorBase.nombre} llega con ${diferencia} puntos de ventaja ELO base.`,
          '¿A quién subirías votando?',
        ].join('\n'),
        url: dueloUrl,
      },
      {
        nativeSuccess: 'Comparación compartida',
        clipboardSuccess: 'Comparación copiada',
      },
    )
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.ranking}
      className="py-10 sm:py-12"
      lateralKanji={{ left: '対', right: '比' }}
      atmosphere="arena"
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Comparar', path: '/comparar' },
        ])}
      />
      <JsonLd id="comparar-page" schema={compararSchema()} />

      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.ranking}
          icon={BarChart3}
          eyebrow="Comparar personajes anime"
          title="Crea un duelo compartible"
          subtitle="Elige dos personajes, revisa su ELO base y abre una comparativa lista para votar o compartir."
          actions={
            <>
              <button
                type="button"
                onClick={elegirAleatorio}
                className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
              >
                <Shuffle className="h-4 w-4" />
                Duelo aleatorio
              </button>
              <button
                type="button"
                onClick={equilibrarRival}
                className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
              >
                <RefreshCw className="h-4 w-4" />
                Rival equilibrado
              </button>
            </>
          }
        />

        <section className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
          <PickerSlot
            label="Personaje A"
            personaje={personajeA}
            excludeSlug={personajeB?.slug}
            onSelect={(slug) => setSlot('a', slug)}
            onClear={() => setSlot('a', '')}
          />
          <div className="flex items-center justify-center pt-0 md:pt-24">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/50 bg-accent-soft font-black text-gold shadow-aura">
              VS
            </span>
          </div>
          <PickerSlot
            label="Personaje B"
            personaje={personajeB}
            excludeSlug={personajeA?.slug}
            onSelect={(slug) => setSlot('b', slug)}
            onClear={() => setSlot('b', '')}
          />
        </section>

        {ambos ? (
          <section className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,rgb(159_29_44_/_0.16),rgb(197_161_90_/_0.08),rgb(7_10_18_/_0.84))] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[11px] font-black text-gold">
                  <Trophy className="h-3.5 w-3.5" />
                  Resultado previo
                </p>
                <h2 className="mt-2 text-2xl font-black text-fg-strong">
                  {ganadorBase.nombre} llega con ventaja base.
                </h2>
              </div>
              <p className="rounded-lg border border-white/10 bg-bg/55 px-4 py-3 text-sm text-fg-muted">
                Diferencia:{' '}
                <span className="font-mono font-black text-fg-strong">{diferencia}</span>{' '}
                puntos ELO base.
              </p>
            </div>

            {/* Tale of the Tape: el cara a cara como cartel de velada —
                対 trazado, retratos a sangre y barras enfrentadas. */}
            <TaleOfTheTape personajeA={personajeA} personajeB={personajeB} />

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={dueloUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Swords className="h-4 w-4" />
                Abrir comparación
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to={`/votar?personaje=${encodeURIComponent(personajeA.slug)}`}
                className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
              >
                <span className="truncate">Retar a {personajeA.nombre}</span>
              </Link>
              <Link
                to={`/votar?personaje=${encodeURIComponent(personajeB.slug)}`}
                className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-all hover:-translate-y-0.5 hover:bg-accent/20"
              >
                <span className="truncate">Retar a {personajeB.nombre}</span>
              </Link>
              <button
                type="button"
                onClick={compartir}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-bold text-fg-strong transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:text-gold"
              >
                <Share2 className="h-4 w-4" />
                Compartir comparación
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-surface/85 p-5 text-sm leading-6 text-fg-muted">
            Elige dos personajes distintos para generar la comparación. También
            puedes usar duelo aleatorio o rival equilibrado para empezar en un clic.
          </section>
        )}
      </div>
    </VisualPageShell>
  )
}

function compararSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Comparar personajes anime',
    url: 'https://animeshowdown.dev/comparar',
    description:
      'Herramienta para seleccionar dos personajes anime y abrir una comparativa compartible en AnimeShowdown.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev',
    },
  }
}

function PickerSlot({ label, personaje, excludeSlug, onSelect, onClear }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/85 p-5">
      <p className="text-[11px] font-black text-gold">
        {label}
      </p>
      {personaje ? (
        <SelectedCharacter personaje={personaje} onClear={onClear} />
      ) : (
        <div className="mt-4">
          <AutocompletePersonaje
            onSelect={onSelect}
            placeholder="Busca un personaje..."
            filtroExtra={(p) => p.slug !== excludeSlug}
          />
        </div>
      )}
    </section>
  )
}

function SelectedCharacter({ personaje, onClear }) {
  const stats = getStatsPersonaje(personaje.slug)
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
      <Link
        to={`/personajes/${personaje.slug}`}
        className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-bg"
      >
        <PersonajeImg
          slug={personaje.slug}
          alt={personaje.nombre}
          className="h-full w-full object-cover object-top transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
      </Link>
      <div className="min-w-0 self-center">
        <h2 className="truncate text-2xl font-black text-fg-strong">
          {personaje.nombre}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{personaje.anime}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <CompareStat label="ELO" value={stats.elo} detail="base" accent />
          <CompareStat label="V" value={stats.wins} detail="est." />
          <CompareStat label="D" value={stats.losses} detail="est." />
        </div>
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-[12px] font-bold text-fg-muted hover:text-gold hover:underline"
        >
          Cambiar personaje
        </button>
      </div>
    </div>
  )
}

function CompareStat({ label, value, detail, accent }) {
  return (
    <div className="rounded-lg border border-white/10 bg-bg/55 p-3">
      <p className="truncate text-[9px] font-black text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-black ${accent ? 'text-gold' : 'text-fg-strong'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-fg-muted">{detail}</p>
    </div>
  )
}

export default CompararPage
