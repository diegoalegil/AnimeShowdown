import './Header.css'

function Header() {
  return (
    <header className="header">
      <a href="#" className="header-brand">
        <span className="header-brand-mark">AS</span>
        <span className="header-brand-text">AnimeShowdown</span>
      </a>
      <nav className="header-nav">
        <a href="#" className="header-nav-link">Inicio</a>
        <a href="#" className="header-nav-link">Personajes</a>
        <a href="#" className="header-nav-link">Torneos</a>
        <a href="#" className="header-nav-link">Ranking</a>
        <a href="#" className="header-nav-link header-nav-link-cta">Login</a>
      </nav>
    </header>
  )
}

export default Header
