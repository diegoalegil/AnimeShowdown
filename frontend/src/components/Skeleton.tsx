import type { ReactNode } from 'react'

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

const CONTENT: Partial<Record<SkeletonVariant, ReactNode>> = {
  card: (
    <>
      {/* 2:3 como PersonajeCard (carta vertical). Con 4/3 el esqueleto era
          más bajo que la card real y todo el grid pegaba un salto (CLS
          sistemático) al resolver. */}
      <span className="block aspect-[2/3] rounded-lg bg-surface-alt" />
      <span className="mt-4 block h-4 w-3/4 rounded-full bg-surface-alt" />
      <span className="mt-2 block h-3 w-1/2 rounded-full bg-surface-alt" />
    </>
  ),
  banner: (
    <span className="flex h-full min-h-48 flex-col justify-end gap-3 p-5">
      <span className="block h-5 w-2/3 rounded-full bg-surface-alt" />
      <span className="block h-3 w-1/2 rounded-full bg-surface-alt" />
    </span>
  ),
}

interface SkeletonProps {
  variant?: SkeletonVariant
  className?: string
}

function Skeleton({ variant = 'line', className = '' }: SkeletonProps) {
  const variantClass = VARIANTS[variant] ?? VARIANTS.line

  return (
    <span
      className={`block animate-pulse motion-reduce:animate-none ${variantClass} ${className}`}
      aria-hidden="true"
    >
      {CONTENT[variant]}
    </span>
  )
}

export default Skeleton
