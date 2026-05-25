function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const variants = {
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  err: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  info: 'border-border bg-surface text-fg-muted',
}

/**
 * Compact label primitive used by `InicioPage.jsx` for card eyebrows.
 *
 * @param {object} props
 * @param {'span'|import('react').ElementType} [props.as='span'] Element or component to render.
 * @param {'ok'|'warn'|'err'|'info'} [props.variant='info'] Semantic tone.
 * @param {string} [props.className] Extra classes for custom page-specific tones.
 * @param {import('react').ReactNode} props.children Badge content.
 * @example
 * <Badge variant="warn">Top 10</Badge>
 */
function Badge({ as: Component = 'span', variant = 'info', className = '', children, ...props }) {
  return (
    <Component
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em]',
        variants[variant] ?? variants.info,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Badge
