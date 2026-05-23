import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, HelpCircle, ShieldCheck, Swords, Trophy } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { CinematicHero, VisualPageShell } from '../components/VisualSystem'
import { BRAND_VISUALS } from '../data/visual-assets'

const FAQ = [
  {
    pregunta: '¿AnimeShowdown usa un ELO matemático puro?',
    respuesta:
      'AnimeShowdown combina un ELO base estimado del catálogo con rankings comunitarios alimentados por votos reales. Las páginas distinguen entre ELO base y ranking competitivo para no confundir estimación con resultado comunitario.',
  },
  {
    pregunta: '¿Qué mueve el ranking competitivo?',
    respuesta:
      'Los votos cara a cara, la actividad agregada y los cortes temporales como histórico, mes o anime. Cada duelo aporta una señal pública sobre preferencia de la comunidad.',
  },
  {
    pregunta: '¿Los votos invitados cuentan igual?',
    respuesta:
      'Los votos invitados permiten probar la arena con límite y peso reducido. Las cuentas verificadas tienen historial, más protección antiabuso y progresión persistente.',
  },
  {
    pregunta: '¿El ranking decide quién es más fuerte en canon?',
    respuesta:
      'No. Es un ranking competitivo de comunidad. Puede reflejar popularidad, preferencia, debate y percepción de poder, pero no sustituye información oficial de cada obra.',
  },
]

function MetodologiaEloPage() {
  useSeo({
    title: 'Metodología del ranking',
    description:
      'Cómo funciona el ranking competitivo de AnimeShowdown: ELO base, votos comunitarios, votos invitados, cortes temporales y transparencia del sistema.',
    canonical: 'https://animeshowdown.dev/metodologia-elo',
    image: BRAND_VISUALS.ranking.image,
  })

  return (
    <VisualPageShell visual={BRAND_VISUALS.ranking} className="py-10 sm:py-12" lateralKanji={{ left: '理', right: '戦' }}>
      <JsonLd id="breadcrumbs" schema={breadcrumbsSchema([
        { label: 'Inicio', path: '/' },
        { label: 'Metodología del ranking', path: '/metodologia-elo' },
      ])} />
      <JsonLd id="faq-metodologia" schema={faqPageSchema(FAQ)} />
      <div className="mx-auto max-w-6xl">
        <CinematicHero
          visual={BRAND_VISUALS.ranking}
          icon={BarChart3}
          eyebrow="Metodología"
          title="Cómo funciona el ranking de AnimeShowdown"
          subtitle="Una guía clara para leer ELO base, votos comunitarios y rankings temporales sin prometer precisión absoluta."
          actions={
            <>
              <Link to="/votar" className="as-button-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-black">
                <Swords className="h-4 w-4" />
                Votar ahora
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/ranking" className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
                <Trophy className="h-4 w-4" />
                Ver ranking
              </Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={BarChart3}
            title="ELO base"
            text="Estimación inicial del catálogo para ordenar personajes cuando aún no hay suficientes votos comunitarios."
          />
          <InfoCard
            icon={Swords}
            title="Ranking competitivo"
            text="Tabla alimentada por votos reales, periodos y actividad. Es la señal viva de la comunidad."
          />
          <InfoCard
            icon={ShieldCheck}
            title="Protección antiabuso"
            text="Los invitados tienen límite y peso reducido. Las cuentas mantienen historial y ayudan a proteger el ranking."
          />
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">
            Lectura correcta
          </p>
          <h2 className="mt-1 text-2xl font-black text-fg-strong">
            Qué significa ganar un duelo
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-fg-muted">
            Ganar en AnimeShowdown significa que la comunidad eligió a ese
            personaje en un enfrentamiento concreto. Esa señal puede venir por
            carisma, popularidad, percepción de fuerza, nostalgia o debate. Por
            eso la web separa rankings históricos, mensuales, por anime y ELO
            base estimado.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/ranking" className="as-button-primary rounded-lg px-4 py-2 text-sm font-black">
              Ver tabla viva
            </Link>
            <Link to="/faq" className="as-button-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
              <HelpCircle className="h-4 w-4" />
              Leer FAQ
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.pregunta} className="rounded-xl border border-border bg-bg/45 p-4">
              <h2 className="text-base font-bold text-fg-strong">{item.pregunta}</h2>
              <p className="mt-2 text-[13px] leading-6 text-fg-muted">{item.respuesta}</p>
            </article>
          ))}
        </section>
      </div>
    </VisualPageShell>
  )
}

function InfoCard({ icon: Icon, title, text }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft text-gold">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="mt-4 text-lg font-black text-fg-strong">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{text}</p>
    </article>
  )
}

export default MetodologiaEloPage
