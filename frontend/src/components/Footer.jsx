function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="flex flex-wrap items-center justify-center gap-3 px-5 py-5 text-center sm:justify-between sm:px-8 sm:text-left">
        <p className="text-[13px] text-fg-muted">
          © 2026{' '}
          <strong className="font-bold text-fg-strong">AnimeShowdown</strong> —
          proyecto portfolio de Diego Alegil (DAM 1.º)
        </p>
        <nav className="flex gap-4">
          <a
            href="https://github.com/diegoalegil/AnimeShowdown"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-fg-muted transition-colors hover:text-accent"
          >
            GitHub
          </a>
          <a
            href="#"
            className="text-[13px] text-fg-muted transition-colors hover:text-accent"
          >
            Términos
          </a>
          <a
            href="#"
            className="text-[13px] text-fg-muted transition-colors hover:text-accent"
          >
            Contacto
          </a>
        </nav>
      </div>
    </footer>
  )
}

export default Footer
