import { ArrowRight, Swords } from 'lucide-react'
import { Link } from 'react-router-dom'
import PersonajeImg from '../../../../components/PersonajeImg'
import { buildDuelVoteUrl } from '../pulso-utils'
import CardEyebrow from './CardEyebrow'

function DueloDestacadoCard({ duelo, torneoEnCurso }) {
  const a = duelo?.personajeA
  const b = duelo?.personajeB
  const tieneDuelo = Boolean(a && b)
  const destino = tieneDuelo
    ? buildDuelVoteUrl(a, b)
    : torneoEnCurso
      ? `/torneos/${torneoEnCurso.slug}`
      : '/votar'
  const titulo = tieneDuelo
    ? 'Vota el duelo que mueve el meta'
    : torneoEnCurso
      ? torneoEnCurso.nombre
      : 'Vota tu primer duelo del día'
  const subtitulo = tieneDuelo
    ? 'Dos personajes. Un click. Sin registro para empezar.'
    : torneoEnCurso
      ? 'Hay un bracket activo esperando votos de la comunidad.'
      : 'Elige favorito, mira el feedback y entra en la liga.'

  return (
    <Link
      to={destino}
      className="group relative flex min-h-[220px] flex-col gap-4 overflow-hidden rounded-xl border border-amber-500/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/60 sm:p-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 18% 8%, rgb(197 161 90 / 0.20), transparent 16rem), radial-gradient(circle at 86% 0%, rgb(36 198 220 / 0.14), transparent 18rem), linear-gradient(180deg, rgb(255 255 255 / 0.035), transparent 45%)',
        }}
      />
      <CardEyebrow icon={Swords} label="Duelo destacado" tono="relative text-amber-300" />
      <div className="relative grid flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h3 className="max-w-xl text-2xl font-black leading-tight tracking-tight text-fg-strong sm:text-3xl">
            {titulo}
          </h3>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-fg-muted">
            {subtitulo}
          </p>
        </div>
        {tieneDuelo ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <DestacadoAvatar personaje={a} />
            <span className="font-mono text-2xl font-black text-gold">VS</span>
            <DestacadoAvatar personaje={b} />
          </div>
        ) : torneoEnCurso ? (
          // Si no hay duelo concreto pero sí un torneo en curso, mostrar el
          // banner del torneo (más informativo que el kanji genérico).
          // Mantenemos el kanji como overlay sutil arriba a la derecha
          // para conservar identidad visual.
          <div
            aria-hidden="true"
            className="relative h-24 w-40 overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-500/5 sm:h-28 sm:w-48"
            style={{
              backgroundImage: `url("/assets/tournament-banners/${torneoEnCurso.slug}.webp")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-bg/85 via-bg/30 to-transparent"
            />
            <span
              lang="ja"
              className="absolute right-2 top-1 font-mono text-xl font-black text-amber-200 drop-shadow"
            >
              戦
            </span>
          </div>
        ) : (
          <div
            aria-hidden="true"
            lang="ja"
            className="flex h-24 w-24 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 font-mono text-5xl font-black text-amber-200"
          >
            戦
          </div>
        )}
      </div>
      <span className="relative mt-auto inline-flex items-center gap-1 text-sm font-bold text-amber-300 transition-transform group-hover:translate-x-0.5">
        {tieneDuelo ? 'Votar ahora' : 'Entrar'}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

function DestacadoAvatar({ personaje }) {
  return (
    <div className="min-w-0 text-center">
      <PersonajeImg
        slug={personaje.slug}
        alt={personaje.nombre}
        className="mx-auto h-28 w-20 rounded-xl object-cover object-top shadow-[0_18px_55px_-32px_rgba(0,0,0,0.9)] sm:h-32 sm:w-24"
      />
      <p className="mt-2 line-clamp-1 max-w-24 text-[12px] font-bold text-fg-strong">
        {personaje.nombre}
      </p>
    </div>
  )
}

export default DueloDestacadoCard
