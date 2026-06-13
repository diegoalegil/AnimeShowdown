import type { CSSProperties, ReactNode } from 'react'

type SkeletonVariant = 'card' | 'line' | 'circle' | 'banner' | 'box'

const VARIANTS: Record<SkeletonVariant, string> = {
  // overflow-hidden: los usos con alto fijo (h-36, h-[34rem]) truncan el
  // contenido interno en el borde de la card en vez de desbordarlo.
  card: 'min-h-52 overflow-hidden rounded-2xl border border-border bg-surface p-4',
  line: 'h-4 rounded-full bg-surface-alt',
  circle: 'aspect-square rounded-full bg-surface-alt',
  banner: 'min-h-48 rounded-2xl border border-border bg-surface',
  // Rectángulo neutro sin alto fijo: el tamaño/proporción se controla 100%
  // desde className (h-*, w-*, aspect-*). Útil para los esqueletos de página
  // (barras de título, frames de retrato, filas) donde line (rounded-full) o
  // card (con contenido interno) no encajan.
  box: 'rounded-lg bg-surface-alt',
}

// La piel de marca (.skl, index.css) sustituye al animate-pulse genérico:
// un barrido carmesí→oro recorre cada GHOST, desincronizado por nth-child.
// En card/banner el barrido va en los ghosts internos — el contenedor es un
// panel quieto. reduced-motion lo resuelve el propio CSS (hairline dorada).
const CONTENT: Partial<Record<SkeletonVariant, ReactNode>> = {
  card: (
    <>
      {/* 2:3 como PersonajeCard (carta vertical). Con 4/3 el esqueleto era
          más bajo que la card real y todo el grid pegaba un salto (CLS
          sistemático) al resolver. */}
      <span className="skl block aspect-[2/3] rounded-lg bg-surface-alt" />
      <span className="skl mt-4 block h-4 w-3/4 rounded-full bg-surface-alt" />
      <span className="skl mt-2 block h-3 w-1/2 rounded-full bg-surface-alt" />
    </>
  ),
  banner: (
    <span className="flex h-full min-h-48 flex-col justify-end gap-3 p-5">
      <span className="skl block h-5 w-2/3 rounded-full bg-surface-alt" />
      <span className="skl block h-3 w-1/2 rounded-full bg-surface-alt" />
    </span>
  ),
}

interface SkeletonProps {
  variant?: SkeletonVariant
  className?: string
  // Para alturas que vienen de datos (las reservas calibradas de la home):
  // las clases arbitrarias generadas en runtime no sobreviven el purge de
  // Tailwind, un style inline sí.
  style?: CSSProperties
}

function Skeleton({ variant = 'line', className = '', style }: SkeletonProps) {
  const variantClass = VARIANTS[variant] ?? VARIANTS.line
  // Las variantes sin contenido interno SON el ghost: el barrido va en la
  // raíz. card/banner lo llevan en sus spans internos.
  const sweep = CONTENT[variant] ? '' : ' skl'

  return (
    <span
      className={`block${sweep} ${variantClass} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {CONTENT[variant]}
    </span>
  )
}

export default Skeleton
