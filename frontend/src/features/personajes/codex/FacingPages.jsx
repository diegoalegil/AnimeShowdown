import { useState } from 'react'
// Ajusta la profundidad del import a la ubicación real del archivo. Asumido:
// src/features/personajes/codex/FacingPages.jsx  →  src/components/PersonajeImg
import PersonajeImg from '../../../components/PersonajeImg'

/**
 * FacingPages — el pliego de MATCHUPS como PÁGINAS ENFRENTADAS.
 *
 * <p>Un par de retratos a sangre (protagonista a la izquierda, rival a la
 * derecha) con la cifra del head-to-head al centro bajo el kanji 対. El par es
 * navegable (teclado + botones + puntos). Cada retrato usa PersonajeImg con su
 * `colorDominante` para teñir el wash de su página.
 *
 * <p>Sin matchups → PÁGINAS EN BLANCO con CTA a retarlo en /votar (honesto: no
 * inventa rivales). No anima nada pesado: el cambio de par es un cross-fade de
 * opacity gestionado por React (cero layout), válido con reduced-motion.
 *
 * @param {object} props
 * @param {{slug:string, nombre:string, anime:string, imagenColorDominante?:string}}
 *   props.personaje  El protagonista de la ficha (shape actual del catálogo).
 * @param {Array<{rival:{slug:string, nombre:string, anime:string, imagenUrl?:string,
 *   imagenColorDominante?:string}, wins:number, losses:number}>} [props.matchups]
 *   Agregado de /api/personajes/:slug/matchups (mismas claves wins/losses que
 *   HistorialCompetitivo). Vacío ⇒ páginas en blanco.
 * @param {(rivalSlug?:string)=>void} [props.onRetar]  Click del CTA / "retar".
 * @returns {JSX.Element}
 */
export default function FacingPages({ personaje, matchups = [], onRetar }) {
  const [idx, setIdx] = useState(0)
  const total = matchups.length

  if (total === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface text-center">
        <div className="flex gap-2.5 opacity-50" aria-hidden="true">
          <span className="h-[78px] w-[54px] rounded-lg border border-border bg-surface-alt" />
          <span className="h-[78px] w-[54px] rounded-lg border border-border bg-surface-alt" />
        </div>
        <p className="text-sm font-semibold text-fg-strong">Páginas en blanco</p>
        <p className="max-w-xs text-xs text-fg-muted">
          {personaje.nombre} aún no tiene rivales recurrentes. Sé el primero en escribir su
          historia.
        </p>
        <button
          type="button"
          onClick={() => onRetar?.()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-[18px] text-[13px] font-bold text-white transition-colors hover:bg-accent-hover"
        >
          Retarlo en /votar ›
        </button>
      </div>
    )
  }

  const safe = ((idx % total) + total) % total
  const cur = matchups[safe]
  const prev = () => setIdx((v) => v - 1)
  const next = () => setIdx((v) => v + 1)

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-[18px]">
        <FacingPage
          nombre={personaje.nombre}
          anime={personaje.anime}
          slug={personaje.slug}
          color={personaje.imagenColorDominante}
          side="left"
        />
        <div className="flex min-w-[72px] flex-col items-center justify-center gap-1.5 sm:min-w-[110px]">
          <span
            className="font-kanji-serif text-[clamp(28px,7vw,42px)] font-bold leading-none"
            style={{ color: 'color-mix(in srgb, var(--color-gold) 70%, transparent)' }}
            aria-hidden="true"
          >
            対
          </span>
          <div
            className="font-mono text-[clamp(20px,5vw,30px)] font-bold tabular-nums"
            role="img"
            aria-label={`Head to head con ${cur.rival.nombre}: ${cur.wins} victorias, ${cur.losses} derrotas`}
          >
            <span className="text-success">{cur.wins}</span>
            <span className="text-fg-muted">–</span>
            <span className="text-danger">{cur.losses}</span>
          </div>
          <span className="font-mono text-[10px] text-fg-muted">{cur.wins + cur.losses} duelos</span>
        </div>
        <FacingPage
          nombre={cur.rival.nombre}
          anime={cur.rival.anime}
          slug={cur.rival.slug}
          src={cur.rival.imagenUrl}
          color={cur.rival.imagenColorDominante}
          side="right"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={prev}
          aria-label="Rival anterior"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-[13px] font-semibold text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
        >
          ‹ Anterior
        </button>
        <div className="flex gap-1.5" aria-hidden="true">
          {matchups.map((m, i) => (
            <span
              key={m.rival.slug ?? i}
              className={`h-2 w-2 rounded-full ${i === safe ? 'bg-gold' : 'bg-border'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Rival siguiente"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-[13px] font-semibold text-fg-strong transition-colors hover:border-gold/50 hover:text-gold"
        >
          Siguiente ›
        </button>
      </div>
    </div>
  )
}

/**
 * Una página enfrentada: retrato a sangre con wash teñido por colorDominante
 * y scrim inferior de legibilidad. Componente auxiliar a nivel de módulo
 * (regla react-refresh / Compiler: nunca definido dentro de otro componente).
 *
 * @param {object} props
 * @param {string} props.nombre
 * @param {string} props.anime
 * @param {string} props.slug
 * @param {string} [props.src]
 * @param {string} [props.color]  Hex del color dominante (solo en `style`).
 * @param {'left'|'right'} props.side
 */
function FacingPage({ nombre, anime, slug, src, color, side }) {
  const right = side === 'right'
  return (
    <div
      className="relative min-h-[200px] overflow-hidden rounded-xl border border-border-gold-subtle"
      style={{
        background: `linear-gradient(${right ? '225deg' : '135deg'}, color-mix(in srgb, ${
          color ? `${color}` : 'var(--color-accent)'
        } 45%, var(--color-canvas)), var(--color-canvas) 80%)`,
      }}
    >
      <PersonajeImg
        slug={slug}
        src={src}
        alt={nombre}
        loading="lazy"
        sizes="(min-width: 640px) 320px, 45vw"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--color-canvas) 82%, transparent))' }}
        aria-hidden="true"
      />
      <div className={`absolute inset-x-0 bottom-0 p-3.5 ${right ? 'text-right' : ''}`}>
        <p className="m-0 font-mono text-[10px] text-gold">{anime}</p>
        <p className="m-0 mt-0.5 font-display text-[clamp(1rem,3vw,1.3rem)] font-bold text-fg-strong">
          {nombre}
        </p>
      </div>
    </div>
  )
}
