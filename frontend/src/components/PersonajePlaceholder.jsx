/**
 * Placeholder premium para personajes sin imagen disponible.
 *
 * Reemplaza el icono de imagen rota del navegador (clásico cuadradito
 * con interrogación) por una "carta" con identidad visual de
 * AnimeShowdown: gradient diagonal, iniciales grandes, nombre del
 * personaje y anime, kanji decorativo de fondo. Mantiene el aspect
 * ratio del slot original para no romper el grid.
 *
 * Se usa como fallback de <PersonajeImg> cuando onError dispara, o
 * directamente cuando sabemos que no hay imagen aún.
 */

import KanjiStroke from './KanjiStroke'

// Genera iniciales del nombre — "Monkey D. Luffy" → "ML", "Akame" → "AK".
function iniciales(nombre) {
  const palabras = nombre.trim().split(/\s+/).filter((w) => w.length > 1)
  if (palabras.length === 0) return '?'
  if (palabras.length === 1) {
    return palabras[0].slice(0, 2).toUpperCase()
  }
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase()
}

// Hash determinístico dentro de la paleta fija de marca. El personaje
// conserva variación visual sin convertir la web en selector de colores.
function tonoPara(nombre) {
  let h = 0
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0
  const tonos = [
    { from: 'from-accent/24', via: 'via-gold/8', text: 'text-gold/80' },
    { from: 'from-gold/20', via: 'via-accent/8', text: 'text-gold/80' },
    { from: 'from-electric/18', via: 'via-accent/8', text: 'text-electric/80' },
    { from: 'from-surface-alt', via: 'via-accent/10', text: 'text-fg-strong/75' },
    { from: 'from-accent/18', via: 'via-electric/8', text: 'text-fg-strong/75' },
  ]
  return tonos[h % tonos.length]
}

function PersonajePlaceholder({ nombre, anime, className = '' }) {
  const tono = tonoPara(nombre)
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden bg-surface-alt ${className}`}
      aria-label={`${nombre} (imagen pendiente)`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br to-slate-900/40 ${tono.from} ${tono.via}`}
      />
      {/* Patrón decorativo: kanji 戦 (sen, "batalla") de fondo, dibujado
          trazo a trazo cada vez que el placeholder monta. Cae al
          carácter unicode si KanjiVG no tiene este kanji (siempre lo
          tiene — es de los 77 que generamos). */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute opacity-[0.08] ${tono.text}`}
      >
        <KanjiStroke
          kanji="戦"
          size="10rem"
          strokeMs={600}
          gapMs={150}
          strokeWidth={3}
        />
      </span>
      <div className="relative z-10 flex flex-col items-center gap-1 px-3 text-center">
        <span
          className={`font-mono text-3xl font-extrabold tracking-tight ${tono.text}`}
        >
          {iniciales(nombre)}
        </span>
        <p className="line-clamp-2 text-[11px] font-bold text-fg-strong">
          {nombre}
        </p>
        <p className="line-clamp-1 text-[9px] uppercase tracking-wider text-fg-muted">
          {anime}
        </p>
        <p className="mt-1 text-[9px] italic text-fg-muted/70">
          Imagen pendiente
        </p>
      </div>
    </div>
  )
}

export default PersonajePlaceholder
