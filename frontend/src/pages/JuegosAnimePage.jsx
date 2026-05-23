import { Link } from 'react-router-dom'
import { ArrowRight, Eye, Gamepad2, Grid3X3, Sparkles, Swords, Type } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const JUEGOS = [
  ['Shadow Guess', 'Adivina el personaje por silueta borrosa.', '/games/shadow-guess', Eye],
  ['Anime Reveal', 'Reconoce el anime viendo solo el personaje.', '/games/anime-reveal', Type],
  ['AniGrid', 'Wordle de personajes anime con pistas.', '/games/anigrid', Grid3X3],
  ['Impostor Trial', 'Encuentra al personaje que no pertenece al anime.', '/games/impostor-trial', Sparkles],
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
]

function JuegosAnimePage() {
  useSeo({
    title: 'Juegos anime online',
    description:
      'Juegos anime online diarios en AnimeShowdown: Shadow Guess, Anime Reveal, AniGrid, Impostor Trial y ELO Duel. Juega gratis y comparte tu resultado.',
    canonical: 'https://animeshowdown.dev/juegos/anime',
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.games} className="py-10 sm:py-12" lateralKanji={{ left: '遊', right: '戯' }}>
      <JsonLd id="breadcrumbs" schema={breadcrumbsSchema([
        { label: 'Inicio', path: '/' },
        { label: 'Juegos anime online', path: '/juegos/anime' },
      ])} />
      <JsonLd id="faq-juegos-anime" schema={faqPageSchema(FAQ)} />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.games}
          icon={Gamepad2}
          eyebrow="Juegos anime online"
          title="Daily trials para fans del anime"
          subtitle="Adivina personajes, detecta impostores y reta tu memoria otaku con juegos diarios pensados para compartir resultado."
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

        <section className="grid gap-4 sm:grid-cols-2">
          {JUEGOS.map(([title, text, to, Icon]) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/45"
            >
              <Icon className="h-5 w-5 text-gold" />
              <h2 className="mt-4 text-xl font-black text-fg-strong">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-fg-muted">{text}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-gold">
                Jugar
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </VisualPageShell>
  )
}

export default JuegosAnimePage
