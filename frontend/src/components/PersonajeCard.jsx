import { Link } from 'react-router-dom'
import { imagenPersonaje } from '../data/personajes'

function PersonajeCard({ slug, nombre, anime }) {
  return (
    <Link to={`/personajes/${slug}`} className="group block">
      <article className="relative overflow-hidden rounded-xl border border-border bg-surface transition-all duration-200 group-hover:-translate-y-1 group-hover:border-accent/40">
        <img
          src={imagenPersonaje(slug)}
          alt={nombre}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3.5 pt-10">
          <h3 className="text-sm font-bold text-fg-strong">{nombre}</h3>
          <p className="text-[12px] text-fg-muted">{anime}</p>
        </div>
      </article>
    </Link>
  )
}

export default PersonajeCard
