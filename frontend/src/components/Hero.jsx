import './Hero.css'

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <span className="hero-eyebrow">Beta · 96 personajes</span>
        <h1 className="hero-title">
          Vota a tus personajes de <span className="hero-title-accent">anime</span> favoritos
        </h1>
        <p className="hero-subtitle">
          Torneos cara a cara, brackets visuales y rankings ELO en vivo. Quédate con el campeón del próximo bracket.
        </p>
        <div className="hero-actions">
          <a href="#" className="hero-cta-primary">Explora torneos</a>
          <a href="#" className="hero-cta-secondary">Ver ranking</a>
        </div>
      </div>
    </section>
  )
}

export default Hero
