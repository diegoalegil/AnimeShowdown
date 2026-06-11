import { useEffect, useRef, useState } from 'react'
import {
  Crown,
  Medal,
} from 'lucide-react'
import { AppLink } from '../../../components/AppLink'
import PersonajeImg from '../../../components/PersonajeImg'
import { markPersonajeHero } from '../../../lib/viewTransitions'
import EloSparkline from './EloSparkline'

/**
 * Visible una sola vez: dispara la entrada escalonada del podio cuando el
 * grid entra en viewport. Sin IntersectionObserver (o antes del mount) el
 * podio se muestra directamente en su estado final.
 */
function useInViewOnce(ref) {
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )
  useEffect(() => {
    if (inView) return undefined
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
      },
      // Umbral mínimo: con 0.15 el podio podía quedarse invisible si asoma
      // recortado por abajo en el primer viewport y nunca llega al 15%.
      { threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView, ref])
  return inView
}

/**
 * Podio "Salón del Trono": god-rays oblicuos y corona viva para el campeón,
 * destello de borde para plata y bronce, y entrada escalonada al hacer
 * scroll. Todo lo decorativo es aria-hidden y solo anima transform/opacity;
 * los keyframes viven en index.css y respetan prefers-reduced-motion y la
 * pausa global de pestaña oculta (html.as-tab-hidden).
 */
function RankingPodium({ top3, historyBySlug = {} }) {
  const gridRef = useRef(null)
  const inView = useInViewOnce(gridRef)
  const [primero, segundo, tercero] = top3
  return (
    <div
      ref={gridRef}
      data-trono-in={inView || undefined}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6"
    >
      <PodioCard
        personaje={primero}
        rank={1}
        highlighted
        orden={2}
        history={historyBySlug[primero.slug]}
        className="col-span-2 sm:order-2 sm:col-span-1"
      />
      <PodioCard
        personaje={segundo}
        rank={2}
        orden={0}
        history={historyBySlug[segundo.slug]}
        className="sm:order-1"
      />
      <PodioCard
        personaje={tercero}
        rank={3}
        orden={1}
        history={historyBySlug[tercero.slug]}
        className="sm:order-3"
      />
    </div>
  )
}

function TronoRays() {
  return (
    <span
      aria-hidden="true"
      className="trono-rays pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <span className="trono-ray trono-ray--a" />
      <span className="trono-ray trono-ray--b" />
      <span className="trono-ray trono-ray--c" />
    </span>
  )
}

function PodioCard({ personaje, rank, highlighted, history, orden = 0, className = '' }) {
  const retratoRef = useRef(null)
  if (!personaje?.slug) return null
  const tone =
    rank === 1
      ? {
          border: 'border-medal-gold/70',
          bg: 'bg-gradient-to-b from-medal-gold/15 via-medal-gold/5 to-transparent',
          text: 'text-medal-gold',
          icon: Crown,
          label: 'Campeón actual',
        }
      : rank === 2
        ? {
            border: 'border-medal-silver/50',
            bg: 'bg-gradient-to-b from-medal-silver/10 via-medal-silver/5 to-transparent',
            text: 'text-medal-silver',
            hoverGlow: 'hover:shadow-aura [--aura-color:var(--color-medal-silver-aura)]',
            shine: 'trono-shine--plata',
            icon: Medal,
            label: '2º puesto',
          }
        : {
            border: 'border-medal-bronze/50',
            bg: 'bg-gradient-to-b from-medal-bronze/10 via-medal-bronze/5 to-transparent',
            text: 'text-medal-bronze',
            hoverGlow: 'hover:shadow-aura [--aura-color:var(--color-medal-bronze-aura)]',
            shine: 'trono-shine--bronce',
            icon: Medal,
            label: '3er puesto',
          }
  const Icon = tone.icon
  const linkLayout = highlighted
    ? 'grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 text-left sm:flex sm:flex-col sm:items-center sm:gap-2 sm:p-3 sm:pt-6 sm:text-center'
    : 'flex flex-col items-center gap-2 p-3 pt-4 text-center'

  return (
    <div className={`trono-card relative ${className}`} style={{ '--trono-i': orden }}>
      {highlighted && (
        <span
          aria-hidden="true"
          className="trono-aura pointer-events-none absolute inset-0 rounded-2xl shadow-aura-lg [--aura-color:var(--color-medal-gold-aura)]"
        />
      )}
      <AppLink
        to={`/personajes/${personaje.slug}`}
        // El retrato del podio viaja hasta el hero del detalle (morph).
        onClick={() => markPersonajeHero(retratoRef.current)}
        className={`group relative h-full overflow-hidden rounded-2xl border-2 transition-all motion-safe:hover:-translate-y-1 ${linkLayout} ${tone.border} ${tone.bg} ${tone.hoverGlow ?? ''}`}
      >
        {rank === 1 ? (
          <TronoRays />
        ) : (
          <span
            aria-hidden="true"
            className={`trono-shine pointer-events-none absolute inset-0 rounded-2xl ${tone.shine}`}
          />
        )}
        <span
          className={`relative inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${tone.border} ${tone.text} ${highlighted ? 'col-span-2 justify-self-start sm:justify-self-auto' : ''}`}
        >
          <Icon className="h-3 w-3" />
          #{rank}
          {highlighted && ` · ${tone.label}`}
        </span>
        <div
          className={`relative w-full ${
            highlighted
              ? 'max-w-[8.5rem] sm:mx-auto sm:max-w-none'
              : 'mx-auto max-w-[8rem] sm:max-w-none'
          }`}
        >
          {rank === 1 && (
            <Crown
              aria-hidden="true"
              className="trono-crown absolute -top-3 left-1/2 z-10 h-7 w-7 text-medal-gold drop-shadow-scrim"
            />
          )}
          <div
            ref={retratoRef}
            className={`relative aspect-[2/3] w-full overflow-hidden rounded-2xl border ${tone.border} bg-surface ${
              highlighted ? '' : 'opacity-95'
            }`}
          >
            <PersonajeImg
              slug={personaje.slug}
              src={personaje.imagenUrl}
              nombre={personaje.nombre}
              colorDominante={personaje.imagenColorDominante}
              alt={personaje.nombre}
              loading="eager"
              sizes={highlighted ? '(min-width: 640px) 190px, 136px' : '128px'}
              fit="contain"
              position="center"
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </div>
        <div
          className={`relative flex min-w-0 flex-col gap-0.5 ${
            highlighted ? 'items-start sm:items-center' : 'items-center'
          }`}
        >
          <h3
            className={`line-clamp-1 font-bold text-fg-strong group-hover:text-gold ${
              highlighted ? 'text-base sm:text-lg' : 'text-sm'
            }`}
          >
            {personaje.nombre}
          </h3>
          <p className="line-clamp-1 text-[11px] text-fg-muted">
            {personaje.anime}
          </p>
          <p
            className={`mt-1 font-mono font-extrabold tabular-nums ${tone.text} ${
              highlighted ? 'text-2xl' : 'text-lg'
            }`}
          >
            {personaje.elo}
            <span className="ml-1 text-[10px] opacity-70">
              ELO
            </span>
          </p>
          <EloSparkline points={history} className="mt-1" />
        </div>
      </AppLink>
    </div>
  )
}

export default RankingPodium
