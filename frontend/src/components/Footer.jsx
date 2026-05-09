import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-credit">
          © 2026 <strong>AnimeShowdown</strong> — proyecto portfolio de Diego Alegil (DAM 1.º)
        </p>
        <nav className="footer-links">
          <a
            href="https://github.com/diegoalegil/AnimeShowdown"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
          <a href="#" className="footer-link">Términos</a>
          <a href="#" className="footer-link">Contacto</a>
        </nav>
      </div>
    </footer>
  )
}

export default Footer
