import { forwardRef } from 'react'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const Card = forwardRef(function Card(
  { as: Component = 'article', className = '', children, ...props },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={cx(
        'as-panel as-card-lift relative overflow-hidden rounded-2xl',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
})

export default Card
