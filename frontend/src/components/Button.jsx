import { forwardRef } from 'react'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const variants = {
  primary:
    'border border-accent/55 bg-gradient-to-b from-accent-hover to-accent text-white shadow-[0_0_34px_-14px_var(--color-accent),inset_0_1px_0_rgb(255_255_255_/_0.18)] hover:-translate-y-0.5 hover:brightness-110',
  secondary:
    'border border-white/12 bg-surface/60 text-fg-strong backdrop-blur-md hover:border-gold/55 hover:text-gold',
  ghost:
    'border border-transparent bg-transparent text-fg-muted hover:bg-white/5 hover:text-gold',
}

const sizes = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-sm',
}

/**
 * Reusable action primitive used by `Hero.jsx` and `InicioPage.jsx`.
 *
 * @param {object} props
 * @param {'button'|'a'|import('react').ElementType} [props.as='button'] Element or component to render.
 * @param {'primary'|'secondary'|'ghost'} [props.variant='primary'] Visual treatment based on existing Tailwind tokens.
 * @param {'sm'|'md'|'lg'} [props.size='md'] Control height. `md` is 44px and `lg` is 48px.
 * @param {string} [props.className] Extra classes appended to the primitive styles.
 * @example
 * <Button as={Link} to="/votar" variant="primary" size="lg">
 *   Votar ahora
 * </Button>
 */
const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    className = '',
    type,
    ...props
  },
  ref,
) {
  const resolvedType = Component === 'button' ? type ?? 'button' : type

  return (
    <Component
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-black transition-all disabled:pointer-events-none disabled:opacity-55',
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        className,
      )}
      {...(resolvedType ? { type: resolvedType } : {})}
      {...props}
    />
  )
})

export default Button
