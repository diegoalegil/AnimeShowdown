import { forwardRef } from 'react'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Semantic card shell used by `InicioPage.jsx` for ranking, daily trials and feature cards.
 *
 * @param {object} props
 * @param {'article'|'div'|import('react').ElementType} [props.as='article'] Element or component to render.
 * @param {string} [props.className] Extra layout and tone classes; spacing stays opt-in.
 * @param {import('react').ReactNode} props.children Card content.
 * @example
 * <Card as={Link} to="/games/anigrid" className="p-5">
 *   <h3>AniGrid</h3>
 * </Card>
 */
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
