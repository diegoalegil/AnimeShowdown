import { isValidElement } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import EditorialCover from './EditorialCover'
import { BRAND_VISUALS } from '../data/visual-assets'

function isStructuredAction(action) {
  return (
    action &&
    typeof action === 'object' &&
    !Array.isArray(action) &&
    !isValidElement(action) &&
    typeof action.to === 'string' &&
    action.to.length > 0 &&
    typeof action.label === 'string' &&
    action.label.length > 0
  )
}

function isRenderableAction(action) {
  if (action === null || action === undefined || typeof action === 'boolean') {
    return false
  }
  if (typeof action === 'string' || typeof action === 'number') return true
  if (isValidElement(action)) return true
  if (Array.isArray(action)) return action.every(isRenderableAction)
  return false
}

function EmptyStateAction({ action, linkClassName, wrapperClassName }) {
  if (isStructuredAction(action)) {
    return (
      <Link to={action.to} className={linkClassName}>
        {action.label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    )
  }

  if (isRenderableAction(action)) {
    return <div className={wrapperClassName}>{action}</div>
  }

  return null
}

function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  action,
  className = '',
  scene = false,
  visual = BRAND_VISUALS.empty,
}) {
  const body = children ?? description
  const hasCustomBody = children !== undefined && children !== null

  if (scene) {
    return (
      <div
        className={`relative flex min-h-80 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-dashed border-white/12 bg-surface/50 p-8 text-center sm:p-12 ${className}`}
        style={{
          '--empty-accent': visual?.accentRgb ?? '159 29 44',
          '--empty-glow': visual?.glowRgb ?? '197 161 90',
        }}
      >
        <EditorialCover
          visual={visual}
          className="absolute inset-0 rounded-none border-0 opacity-70"
          imageClassName="saturate-110 contrast-105"
        />
        {Icon && (
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/35 bg-gold/10 text-gold shadow-aura [--aura-color:rgb(197_161_90_/_0.8)]">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        {title && (
          <h2 className="relative max-w-xl text-2xl font-black tracking-tight text-fg-strong">
            {title}
          </h2>
        )}
        {body && (
          <div className="relative max-w-lg text-sm leading-7 text-fg-muted">{body}</div>
        )}
        <EmptyStateAction
          action={action}
          linkClassName="relative inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/90 px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
          wrapperClassName="relative mt-2 flex flex-wrap justify-center gap-3"
        />
      </div>
    )
  }

  return (
    <div
      className={`as-panel flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-dashed p-8 text-center sm:p-12 ${className}`}
      role="status"
    >
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/35 bg-gold-soft text-gold">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div className="flex max-w-xl flex-col gap-2">
        {title && (
          <h2 className="text-2xl font-black tracking-tight text-fg-strong">
            {title}
          </h2>
        )}
        {body &&
          (hasCustomBody ? (
            <div className="text-sm leading-7 text-fg-muted">{body}</div>
          ) : (
            <p className="text-sm leading-7 text-fg-muted">{body}</p>
          ))}
      </div>
      <EmptyStateAction
        action={action}
        linkClassName="mt-2 inline-flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/90 px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        wrapperClassName="mt-2 flex flex-wrap justify-center gap-3"
      />
    </div>
  )
}

export default EmptyState
