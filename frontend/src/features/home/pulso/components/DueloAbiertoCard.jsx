import { ArrowRight, Sparkles, Swords } from 'lucide-react'
import { Link } from 'react-router-dom'
import EditorialCover from '../../../../components/EditorialCover'
import PersonajeCutImg from '../../../../components/PersonajeCutImg'
import { getTournamentVisual } from '../../../../data/visual-assets'
import { imagenPersonaje } from '../../../../lib/personajes-core'
import { buildDuelVoteUrl } from '../pulso-utils'
import CardEyebrow from './CardEyebrow'
import PulseCard from './PulseCard'

function DueloAbiertoCard({ duelo, torneoEnCurso }) {
  // Sin duelo del endpoint /enfrentamientos/aleatorio: dos escenarios.
  //  1) Hay torneo IN_PROGRESS → es muy probable que sí queden duelos
  //     pendientes (el endpoint puede haber fallado o estar entre
  //     batches). NO digamos "sin duelos", redirigimos al bracket
  //     donde sí los hay.
  //  2) Sin torneo en curso → modo casual real, copy honesto.
  if (!duelo || !duelo.personajeA || !duelo.personajeB) {
    if (torneoEnCurso) {
      const visual = getTournamentVisual(torneoEnCurso.slug, torneoEnCurso.nombre)
      return (
        <Link
          to={`/torneos/${torneoEnCurso.slug}`}
          className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-accent/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/60 sm:p-5"
        >
          <EditorialCover
            visual={visual}
            className="absolute inset-0 rounded-none border-0 opacity-95"
            imageClassName="saturate-110 contrast-105"
          />
          <CardEyebrow icon={Swords} label="Duelos pendientes" />
          <p className="relative text-[13px] leading-snug text-fg-muted">
            Hay duelos esperando en{' '}
            <span className="font-semibold text-fg-strong">
              {torneoEnCurso.nombre}
            </span>
            . Entra al bracket y vota.
          </p>
          <span className="relative mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold transition-transform group-hover:translate-x-0.5">
            Ir al bracket
            <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )
    }
    return (
      <PulseCard tono="accent">
        <CardEyebrow icon={Swords} label="Modo casual" />
        <p className="text-[13px] text-fg-muted">
          Sin torneos abiertos ahora. Entra al modo casual y vota duelos
          random del catálogo.
        </p>
        <Link
          to="/votar"
          className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold hover:text-gold"
        >
          Ir a votar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </PulseCard>
    )
  }

  const a = duelo.personajeA
  const b = duelo.personajeB
  const destino = buildDuelVoteUrl(a, b)

  return (
    <Link
      to={destino}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-accent/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/60 sm:p-5"
    >
      <CardEyebrow icon={Sparkles} label="Duelo abierto" tono="text-gold" />
      <div className="flex items-center justify-center gap-3">
        <DueloAvatar personaje={a} />
        <span className="font-mono text-xl font-extrabold text-gold">VS</span>
        <DueloAvatar personaje={b} />
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-gold transition-transform group-hover:translate-x-0.5">
        Vota tu favorito
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

function DueloAvatar({ personaje }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <PersonajeCutImg
        slug={personaje.slug}
        fallback={personaje.imagenUrl || imagenPersonaje(personaje.slug)}
        alt={personaje.nombre}
        loading="lazy"
        className="h-28 w-24 rounded-xl border border-accent/20"
        imgClassName="p-1"
      />
      <p className="line-clamp-1 max-w-full text-center text-[11px] font-semibold text-fg-strong">
        {personaje.nombre}
      </p>
    </div>
  )
}

export default DueloAbiertoCard
