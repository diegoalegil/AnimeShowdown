function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const layouts = {
  stack: 'flex flex-col gap-2 border-l-2 border-accent/30 pl-4',
  inline: 'flex items-center justify-center gap-3',
}

function StatPill({
  icon: Icon,
  value,
  label,
  layout = 'stack',
  className = '',
  iconClassName = '',
  iconSvgClassName = '',
  valueClassName = '',
  labelClassName = '',
}) {
  const defaultValueClassName =
    layout === 'inline'
      ? 'font-mono text-2xl font-extrabold text-fg-strong tabular-nums'
      : 'font-mono text-4xl font-extrabold tracking-tight text-fg-strong tabular-nums sm:text-5xl'
  const defaultLabelClassName =
    layout === 'inline'
      ? 'text-xs text-fg-muted'
      : 'text-xs font-semibold uppercase tracking-[0.1em] text-fg-muted'

  return (
    <div className={cx(layouts[layout] ?? layouts.stack, className)}>
      {Icon && (
        <span
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gold',
            iconClassName,
          )}
          aria-hidden="true"
        >
          <Icon className={cx('h-5 w-5', iconSvgClassName)} />
        </span>
      )}
      <div className={layout === 'inline' ? 'text-left' : ''}>
        <p
          className={cx(
            defaultValueClassName,
            valueClassName,
          )}
        >
          {value}
        </p>
        <p
          className={cx(
            defaultLabelClassName,
            labelClassName,
          )}
        >
          {label}
        </p>
      </div>
    </div>
  )
}

export default StatPill
