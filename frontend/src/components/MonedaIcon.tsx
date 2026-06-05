/**
 * Icono de moneda — PLACEHOLDER simple y sobrio (decisión del owner: el arte
 * final se sustituirá por un asset curado). Una moneda con una estrella; hereda el
 * color vía `currentColor` (úsalo con `text-gold`). Sin hex literales: el color
 * lo pone la clase Tailwind del contenedor.
 */
interface MonedaIconProps {
  className?: string
  title?: string
}

function MonedaIcon({ className = '', title = 'Moneda' }: MonedaIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
    >
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.16" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.6" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path
        d="M12 8.1l1.06 2.33 2.54.25-1.9 1.7.56 2.49L12 13.5l-2.26 1.27.56-2.49-1.9-1.7 2.54-.25z"
        fill="currentColor"
      />
    </svg>
  )
}

export default MonedaIcon
