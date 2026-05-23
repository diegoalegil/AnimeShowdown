import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Eye,
  Gamepad2,
  Grid3X3,
  Share2,
  Sparkles,
  Swords,
  Trophy,
  Type,
  Vote,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const JUEGOS = [
  {
    title: 'Shadow Guess',
    intent: 'adivina personaje anime',
    text: 'Adivina el personaje por una silueta borrosa con intentos limitados.',
    cadence: 'Daily',
    to: '/games/shadow-guess',
    icon: Eye,
  },
  {
    title: 'Anime Reveal',
    intent: 'adivina el anime',
    text: 'Reconoce de qué anime viene el personaje antes de quedarte sin intentos.',
    cadence: 'Daily',
    to: '/games/anime-reveal',
    icon: Type,
  },
  {
    title: 'AniGrid',
    intent: 'wordle anime',
    text: 'Un puzzle tipo Wordle con pistas de anime, género, rol y universo.',
    cadence: 'Daily',
    to: '/games/anigrid',
    icon: Grid3X3,
  },
  {
    title: 'Impostor Trial',
    intent: 'juego de impostor anime',
    text: 'Encuentra al personaje que no pertenece al anime de la ronda.',
    cadence: 'Daily',
    to: '/games/impostor-trial',
    icon: Sparkles,
  },
  {
    title: 'ELO Duel',
    intent: 'anime higher or lower',
    text: 'Adivina qué personaje tiene más ELO base y protege tu mejor racha.',
    cadence: 'Infinito',
    to: '/games/elo-duel',
    icon: Trophy,
  },
]

const LOOP_STEPS = [
  {
    title: 'Juega el daily',
    text: 'Cada reto cambia con la fecha local. Completar uno ya cuenta para la misión de hoy.',
    icon: CalendarDays,
    to: '/games',
  },
  {
    title: 'Comparte el resultado',
    text: 'El resultado sale en texto corto tipo “Shadow Guess #2026-05-23: 2/5”, listo para móvil.',
    icon: Share2,
    to: '/games/shadow-guess',
  },
  {
    title: 'Mueve el ranking',
    text: 'Después del daily, vota duelos y revisa si tu voto cambió posiciones.',
    icon: Vote,
    to: '/votar',
  },
]

const FAQ = [
  {
    pregunta: '¿Los juegos anime son gratis?',
    respuesta: 'Sí. Los daily trials de AnimeShowdown se pueden jugar gratis desde el navegador.',
  },
  {
    pregunta: '¿Hay un reto nuevo cada día?',
    respuesta: 'Sí. Los juegos diarios usan la fecha local para cambiar el objetivo y proteger la racha.',
  },
  {
    pregunta: '¿Puedo compartir mi resultado?',
    respuesta: 'Sí. Cada resultado genera un texto compartible y usa Web Share API en móvil cuando está disponible.',
  },
  {
    pregunta: '¿Necesito cuenta para jugar?',
    respuesta: 'No necesitas cuenta para probar los juegos diarios. Crear cuenta sirve para guardar mejor progreso, perfil y logros cuando la plataforma crece.',
  },
  {
    pregunta: '¿Qué juego sirve para buscar anime higher or lower?',
    respuesta: 'ELO Duel funciona como un higher or lower de anime: eliges qué personaje crees que tiene más ELO base e intentas encadenar racha.',
  },
]

function JuegosAnimePage() {
  useSeo({
    title: 'Juegos anime online gratis',
    description:
      'Juegos anime online diarios en AnimeShowdown: Shadow Guess, Anime Reveal, AniGrid, Impostor Trial y ELO Duel. Juega gratis, protege tu racha y comparte resultado.',
    canonical: 'https://animeshowdown.dev/juegos/anime',
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.games} className="py-10 sm:py-12" lateralKanji={{ left: '遊', right: '戯' }}>
      <JsonLd id="breadcrumbs" schema={breadcrumbsSchema([
        { label: 'Inicio', path: '/' },
        { label: 'Juegos anime online', path: '/juegos/anime' },
      ])} />
      <JsonLd id="faq-juegos-anime" schema={faqPageSchema(FAQ)} />
      <JsonLd id="itemlist-juegos-anime" schema={juegosItemListSchema()} />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.games}
          icon={Gamepad2}
          eyebrow="Juegos anime online"
          title="Juegos anime online diarios"
          subtitle="Adivina personajes, detecta impostores, juega anime higher or lower y comparte tu resultado diario sin instalar nada."
          actions={
            <>
              <Link to="/games" className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black">
                <Gamepad2 className="h-4 w-4" />
                Ver hub de juegos
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/votar" className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
                <Swords className="h-4 w-4" />
                Votar duelos
              </Link>
            </>
          }
        />

        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <InfoTile icon={CalendarDays} label="Reto nuevo" value="cada día" />
          <InfoTile icon={Share2} label="Resultado" value="compartible" />
          <InfoTile icon={Trophy} label="Loop" value="jugar, votar, ranking" />
        </section>

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
                Catálogo jugable
              </p>
              <h2 className="text-2xl font-black text-fg-strong">
                Qué puedes jugar hoy
              </h2>
            </div>
            <Link
              to="/games"
              className="inline-flex w-fit items-center gap-1.5 text-[13px] font-bold text-gold hover:underline"
            >
              Abrir Anime Daily Trials
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JUEGOS.map((juego) => (
              <GameCard key={juego.to} juego={juego} />
            ))}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
              Ritual diario
            </p>
            <h2 className="text-2xl font-black text-fg-strong">
              Cómo encaja con AnimeShowdown
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {LOOP_STEPS.map((step, index) => (
              <StepBlock key={step.title} step={step} index={index + 1} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 border-y border-white/10 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-fg-muted">
              Después de jugar
            </p>
            <h2 className="mt-1 text-2xl font-black text-fg-strong">
              Convierte tu resultado en algo que enseñar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
              Si vienes por un juego rápido, el siguiente paso natural es compartir
              tu daily, crear tu Top 5 o votar duelos para que el ranking cambie
              con la comunidad.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/mi-top5" className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
              <Share2 className="h-4 w-4" />
              Crear mi Top 5
            </Link>
            <Link to="/ranking" className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
              <Trophy className="h-4 w-4" />
              Ver ranking
            </Link>
          </div>
        </section>
      </div>
    </VisualPageShell>
  )
}

function juegosItemListSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Juegos anime online de AnimeShowdown',
    itemListElement: JUEGOS.map((juego, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Game',
        name: juego.title,
        description: juego.text,
        url: `https://animeshowdown.dev${juego.to}`,
      },
    })),
  }
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-bg/55 p-4 backdrop-blur">
      <Icon className="h-4 w-4 text-gold" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-fg-strong">{value}</p>
    </div>
  )
}

function GameCard({ juego }) {
  const Icon = juego.icon
  return (
    <Link
      to={juego.to}
      className="group rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:bg-surface-alt"
    >
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-5 w-5 text-gold" />
        <span className="rounded-full border border-white/10 bg-bg px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-fg-muted">
          {juego.cadence}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black text-fg-strong">{juego.title}</h3>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold/80">
        {juego.intent}
      </p>
      <p className="mt-3 text-sm leading-6 text-fg-muted">{juego.text}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-gold">
        Jugar
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

function StepBlock({ step, index }) {
  const Icon = step.icon
  return (
    <Link
      to={step.to}
      className="group rounded-xl border border-border bg-surface/85 p-5 transition-colors hover:border-accent/45 hover:bg-surface-alt"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft font-mono text-sm font-black text-gold">
          {index}
        </span>
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <h3 className="mt-4 text-lg font-black text-fg-strong">{step.title}</h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{step.text}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-gold">
        Ir
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export default JuegosAnimePage
