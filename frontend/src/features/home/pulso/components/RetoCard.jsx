import { ArrowRight, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import EditorialCover from '../../../../components/EditorialCover'
import { getGameVisual } from '../../../../data/visual-assets'
import CardEyebrow from './CardEyebrow'

function RetoCard() {
  const visual = getGameVisual('/games/shadow-guess', 'Shadow Guess')

  return (
    <Link
      to="/games/shadow-guess"
      // Altura estable para que la franja superior tenga aire y el sujeto
      // del cover quepa antes del degradado de oscurecimiento.
      className="group relative flex min-h-[13rem] flex-col gap-3 overflow-hidden rounded-xl border border-danger/30 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-danger/60 sm:p-5"
    >
      <EditorialCover
        visual={visual}
        className="absolute inset-0 rounded-none border-0 opacity-95"
        imageClassName="saturate-110 contrast-105"
      />
      <CardEyebrow icon={Calendar} label="Reto del día" tono="relative text-danger" />
      <div className="relative mt-auto flex items-start gap-3">
        <div
          aria-hidden="true"
          lang="ja"
          className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border border-danger/35 bg-bg/65 font-mono text-3xl font-black text-danger shadow-aura"
        >
          影
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-bold text-fg-strong drop-shadow-scrim">
            Adivina la silueta
          </h3>
          <p className="text-[12px] leading-snug text-fg-muted">
            Cinco intentos. Cada fallo aclara un poco la imagen.
          </p>
        </div>
      </div>
      <span className="relative inline-flex items-center gap-1 text-[12px] font-semibold text-danger transition-transform group-hover:translate-x-0.5">
        Jugar daily
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

export default RetoCard
