import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  RefreshCw,
  Share2,
  Shuffle,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, personajeSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'
import PersonajeImg from '../components/PersonajeImg'
import DepthCard from '../components/DepthCard'
import { cutUrl, hasCut } from '../lib/cuts'
import { getAnimeIdentity } from '../data/anime-identities'
import { usePersonajesCatalogo } from '../hooks/usePersonajesCatalogo'
import { fechaDelDia } from '../lib/games'
import { slugifyAnime } from '../lib/animes'
import { imagenPersonaje } from '../lib/personajes-core'
import { shareWithToast } from '../lib/shareWithToast'

function seededIndex(seed, length) {
  if (length <= 0) return 0
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % length
}

function randomPersonaje(personajes, currentSlug) {
  if (personajes.length <= 1) return personajes[0] ?? null
  let next = personajes[Math.floor(Math.random() * personajes.length)]
  let guard = 0
  while (next?.slug === currentSlug && guard < 8) {
    next = personajes[Math.floor(Math.random() * personajes.length)]
    guard += 1
  }
  return next
}

function DescubrePersonajePage() {
  useSeo({
    title: 'Descubre un personaje anime',
    description:
      'Descubre un personaje anime aleatorio en AnimeShowdown, reta su duelo, mira su ficha y comparte a quién te tocó hoy.',
    canonical: 'https://animeshowdown.dev/descubre-personaje',
  })

  const { personajes: catalogoPersonajes } = usePersonajesCatalogo()
  const [manualSlug, setManualSlug] = useState('')
  const personajeDelDia = useMemo(() => {
    if (catalogoPersonajes.length === 0) return null
    const index = seededIndex(`descubre:${fechaDelDia()}`, catalogoPersonajes.length)
    return catalogoPersonajes[index]
  }, [catalogoPersonajes])
  const personajeManual = useMemo(
    () => catalogoPersonajes.find((p) => p.slug === manualSlug) ?? null,
    [catalogoPersonajes, manualSlug],
  )
  const personaje = personajeManual ?? personajeDelDia
  const animeSlug = personaje?.anime ? slugifyAnime(personaje.anime) : ''
  // Identidad curada del universo (kanji + lema) para la placa de la carta 2.5D.
  const identidadAnime = getAnimeIdentity(animeSlug, personaje?.anime ?? '')

  const descubrirOtro = () => {
    const next = randomPersonaje(catalogoPersonajes, personaje?.slug)
    if (next) setManualSlug(next.slug)
  }

  const compartir = async () => {
    if (!personaje) return
    await shareWithToast(
      {
        title: `Hoy me tocó ${personaje.nombre}`,
        text: `Hoy me tocó ${personaje.nombre} de ${personaje.anime} en AnimeShowdown. ¿Lo retarías o lo dejarías pasar?`,
        url: `/personajes/${personaje.slug}`,
      },
      {
        nativeSuccess: 'Personaje compartido',
        clipboardSuccess: 'Texto copiado al portapapeles',
        errorDescription: 'Inténtalo de nuevo en unos segundos.',
      },
    )
  }

  return (
    <VisualPageShell
      visual={BRAND_VISUALS.personajes}
      className="py-10 sm:py-12"
      lateralKanji={{ left: '発', right: '見' }}
      atmosphere="archive"
    >
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Descubre personaje', path: '/descubre-personaje' },
        ])}
      />
      <JsonLd id={`personaje-descubierto-${personaje?.slug ?? 'none'}`} schema={personajeSchema(personaje)} />
      <JsonLd id="descubre-page" schema={descubrePageSchema()} />

      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.personajes}
          icon={Shuffle}
          eyebrow="Descubre personaje"
          title="Tu personaje anime del día"
          subtitle="Una entrada rápida para descubrir roster, retar al personaje que te salga y compartir el hallazgo sin pensar demasiado."
          actions={
            <>
              <button
                type="button"
                onClick={descubrirOtro}
                className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black"
              >
                <RefreshCw className="h-4 w-4" />
                Descubrir otro
              </button>
              {personaje && (
                <Link
                  to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
                  className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
                >
                  <Swords className="h-4 w-4" />
                  Retarlo ahora
                </Link>
              )}
            </>
          }
        />

        {personaje ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(18rem,0.44fr)_minmax(0,1fr)] lg:items-stretch">
            {hasCut(personaje.slug) ? (
              /* Carta 2.5D: el recorte del personaje rompe el marco por arriba
                 (de ahí el aire pt-12) y la escena de fondo es su imagen normal
                 desenfocada. El kanji y el lema salen de la identidad curada
                 del universo. Sin recorte: presentación plana de siempre. */
              <article className="flex items-end justify-center px-2 pb-1 pt-12 sm:pt-14">
                <DepthCard
                  key={personaje.slug}
                  bgSrc={personaje.imagenUrl ?? personaje.imagen ?? imagenPersonaje(personaje.slug)}
                  cutoutSrc={cutUrl(personaje.slug)}
                  name={personaje.nombre}
                  anime={personaje.anime}
                  kanji={identidadAnime.kanji}
                  kanjiMeaning={identidadAnime.emblem}
                  nameTag="h1"
                />
              </article>
            ) : (
              <article className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="relative aspect-[4/5] bg-bg">
                  <PersonajeImg
                    slug={personaje.slug}
                    src={personaje.imagenUrl ?? personaje.imagen ?? imagenPersonaje(personaje.slug)}
                    alt={personaje.nombre}
                    className="h-full w-full object-cover object-top"
                    loading="eager"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/52 to-transparent p-5">
                    <p className="text-[11px] font-black text-gold">
                      Personaje descubierto
                    </p>
                    <h1 className="mt-1 text-3xl font-black leading-tight text-white">
                      {personaje.nombre}
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-white/76">
                      {personaje.anime}
                    </p>
                  </div>
                </div>
              </article>
            )}

            <div className="flex flex-col gap-4">
              <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <StatTile icon={CalendarDays} label="Ritual" value="del día" />
                  <StatTile icon={UserRound} label="Ficha" value="disponible" />
                  <StatTile icon={Trophy} label="Ranking" value="comunitario" />
                </div>
                <p className="text-sm leading-7 text-fg-muted">
                  {personaje.descripcion ||
                    `${personaje.nombre} forma parte del roster de ${personaje.anime} en AnimeShowdown. Puedes ver su ficha, retarlo en un duelo o usarlo como punto de partida para descubrir más personajes.`}
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <ActionLink
                  to={`/personajes/${personaje.slug}`}
                  icon={UserRound}
                  title="Ver ficha completa"
                  text="Ranking, anime, similares y acciones del personaje."
                />
                <ActionLink
                  to={`/votar?personaje=${encodeURIComponent(personaje.slug)}`}
                  icon={Swords}
                  title="Retar en un duelo"
                  text="Fija este personaje en una ronda de voto."
                />
                {animeSlug && (
                  <ActionLink
                    to={`/animes/${animeSlug}`}
                    icon={Sparkles}
                    title={`Explorar ${personaje.anime}`}
                    text="Entra al universo y mira su roster interno."
                  />
                )}
                <ActionLink
                  to="/mi-top5"
                  icon={Trophy}
                  title="Crear mi Top 5"
                  text="Convierte favoritos en una imagen compartible."
                />
              </section>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={compartir}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-gold transition-colors hover:bg-accent/20"
                >
                  <Share2 className="h-4 w-4" />
                  Compartir quién me tocó
                </button>
                <button
                  type="button"
                  onClick={descubrirOtro}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-bold text-fg-strong transition-colors hover:border-accent/45 hover:text-gold"
                >
                  <RefreshCw className="h-4 w-4" />
                  Otro personaje
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-surface p-6 text-sm text-fg-muted">
            No hay personajes disponibles para descubrir ahora mismo.
          </section>
        )}
      </div>
    </VisualPageShell>
  )
}

function descubrePageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Descubre un personaje anime',
    url: 'https://animeshowdown.dev/descubre-personaje',
    description:
      'Página interactiva para descubrir un personaje anime, retarlo en duelo y compartir el resultado.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev',
    },
  }
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-bg/55 p-4">
      <Icon className="h-4 w-4 text-gold" />
      <p className="mt-3 text-[10px] font-black text-fg-muted">
        {label}
      </p>
      <p className="mt-1 text-base font-black text-fg-strong">{value}</p>
    </div>
  )
}

function ActionLink({ to, icon: Icon, title, text }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/45 hover:bg-surface-alt"
    >
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-5 w-5 text-gold" />
        <ArrowRight className="h-4 w-4 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
      </div>
      <h2 className="mt-4 text-lg font-black text-fg-strong">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{text}</p>
    </Link>
  )
}

export default DescubrePersonajePage
