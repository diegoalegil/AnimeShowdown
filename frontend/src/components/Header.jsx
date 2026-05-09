import './Header.css'

const navLinks = [
  { href: '#', label: 'Inicio' },
  { href: '#', label: 'Personajes' },
  { href: '#', label: 'Torneos' },
  { href: '#', label: 'Ranking' },
  { href: '#', label: 'Login', cta: true },
]

function Header() {
  return (
    <header className="header">
      <a href="#" className="header-brand">
        <span className="header-brand-mark">AS</span>
        <span className="header-brand-text">AnimeShowdown</span>
      </a>
      <nav className="header-nav">
        {navLinks.map(({ href, label, cta }) => (
          <a
            key={label}
            href={href}
            className={cta ? 'header-nav-link header-nav-link-cta' : 'header-nav-link'}
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  )
}

export default Header
