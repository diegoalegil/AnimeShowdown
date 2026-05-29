function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const variants = {
  ok: 'border-success/40 bg-success/10 text-success',
  warn: 'border-warning/40 bg-warning/10 text-warning',
  err: 'border-danger/40 bg-danger/10 text-danger',
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
