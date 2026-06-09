function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

// El stack se sostiene con tipografía y jerarquía, sin barra decorativa lateral.
const layouts = {
  stack: 'flex flex-col gap-2',
  inline: 'flex items-center justify-center gap-3',
}

/**
 * Numeric stat primitive used by `Hero.jsx` and `InicioPage.jsx`.
 *
 * @param {object} props
 * @param {import('lucide-react').LucideIcon} [props.icon] Optional icon for inline stats.
 * @param {import('react').ReactNode} props.value Main value, number or animated node.
 * @param {import('react').ReactNode} props.label Short label under or beside the value.
 * @param {'stack'|'inline'} [props.layout='stack'] Vertical stat or icon+value stat.
 * @param {string} [props.className] Extra classes for borders and spacing.
 * @example
 * <StatPill value={<CountUp target={1052} />} label="Personajes" />
 */
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
      : 'text-xs font-semibold text-fg-muted'

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
