import { Link } from 'react-router-dom'
import { ArrowRight, Gamepad2, Swords, Trophy, UserPlus } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const FAQ = [
  {
    pregunta: '¿Qué es AnimeShowdown?',
    respuesta:
      'AnimeShowdown es una plataforma para votar duelos de personajes de anime, jugar retos diarios y ver rankings competitivos creados por la comunidad.',
  },
  {
    pregunta: '¿Necesito cuenta para votar?',
    respuesta:
      'Puedes probar varios votos como invitado. Crear cuenta sirve para guardar historial, rachas, logros y proteger mejor el ranking.',
  },
  {
    pregunta: '¿Qué puedo hacer cada día?',
    respuesta:
      'Completar la misión diaria: votar duelos, jugar un daily trial y revisar cómo se mueve el ranking.',
  },
]

function ComoFuncionaPage() {
  useSeo({
    title: 'Cómo funciona',
    description:
      'Guía rápida de AnimeShowdown: votar duelos anime, completar juegos diarios, leer rankings, seguir personajes y compartir resultados.',
    canonical: 'https://animeshowdown.dev/como-funciona',
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.home} className="py-10 sm:py-12" lateralKanji={{ left: '始', right: '勝' }}>
      <JsonLd id="breadcrumbs" schema={breadcrumbsSchema([
        { label: 'Inicio', path: '/' },
        { label: 'Cómo funciona', path: '/como-funciona' },
      ])} />
      <JsonLd id="faq-como-funciona" schema={faqPageSchema(FAQ)} />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.home}
          icon={Swords}
          eyebrow="Guía rápida"
          title="Vota, juega y vuelve mañana"
          subtitle="AnimeShowdown funciona como un ritual diario para fans: eliges ganadores, completas retos y ves cómo cambia la comunidad."
          actions={
            <>
              <Link to="/votar" className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black">
                <Swords className="h-4 w-4" />
                Empezar votando
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/games" className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
                <Gamepad2 className="h-4 w-4" />
                Jugar daily
              </Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-4">
          <Step icon={Swords} title="1. Vota" text="Elige ganador en duelos cara a cara." />
          <Step icon={Gamepad2} title="2. Juega" text="Completa Shadow Guess, AniGrid o Impostor Trial." />
          <Step icon={Trophy} title="3. Mira ranking" text="Revisa qué personajes suben, caen o dominan." />
          <Step icon={UserPlus} title="4. Guarda progreso" text="Crea cuenta cuando quieras historial, racha y logros." />
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-2xl font-black text-fg-strong">
            La misión diaria
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-fg-muted">
            La primera versión del loop diario vive en tu navegador: 10 votos,
            1 juego diario y una visita al ranking. Es suficiente para entender
            el producto sin cuenta y deja preparado el camino a misiones,
            temporadas y recompensas persistentes.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/votar" className="as-button-primary rounded-lg px-4 py-2 text-sm font-black">
              Completar votos
            </Link>
            <Link to="/ranking" className="as-button-ghost rounded-lg px-4 py-2 text-sm font-bold">
              Ver ranking
            </Link>
            <Link to="/metodologia-elo" className="as-button-ghost rounded-lg px-4 py-2 text-sm font-bold">
              Entender metodología
            </Link>
          </div>
        </section>
      </div>
    </VisualPageShell>
  )
}

function Step({ icon: Icon, title, text }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <Icon className="h-5 w-5 text-gold" />
      <h2 className="mt-4 text-base font-black text-fg-strong">{title}</h2>
      <p className="mt-2 text-[13px] leading-6 text-fg-muted">{text}</p>
    </article>
  )
}

export default ComoFuncionaPage
