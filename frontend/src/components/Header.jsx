const navLinks = [
  { href: '#', label: 'Inicio' },
  { href: '#', label: 'Personajes' },
  { href: '#', label: 'Torneos' },
  { href: '#', label: 'Ranking' },
  { href: '#', label: 'Login', cta: true },
]

const navLinkBase = 'rounded-md px-3.5 py-2 text-sm transition-colors'
const navLinkRegular = `${navLinkBase} font-medium text-fg hover:bg-surface-alt hover:text-fg-strong`
const navLinkCta = `${navLinkBase} ml-2 font-semibold bg-accent text-white hover:bg-accent-hover`

function Header() {
  return (
    <header className="flex flex-col items-stretch gap-3.5 border-b border-border bg-surface px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-4">
      <a href="#" className="flex items-center justify-center gap-3 sm:justify-start">
        <img
          src="/logo.webp"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
        />
        <span className="text-lg font-extrabold tracking-tight text-fg-strong">
          AnimeShowdown
        </span>
      </a>
      <nav className="flex flex-wrap items-center justify-center gap-1">
        {navLinks.map(({ href, label, cta }) => (
          <a key={label} href={href} className={cta ? navLinkCta : navLinkRegular}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  )
}

export default Header
