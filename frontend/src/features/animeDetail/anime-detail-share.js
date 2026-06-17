// ── Contextos para la hoja de impresión (PressSheet) ──────────────────────
// El flujo «anime» es solo texto+enlace (no tiene canvas/painter): se abre la
// hoja en modo sin imagen. Estos builders devuelven el `contexto` que espera
// PressSheet a partir de los textos/URLs de cada vista. El registro de
// dailyProgress cuelga de onShared en PressSheet.

export function buildAnimeRankingContexto({ anime, slug, top10 }) {
  const resumen = top10
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} · ${personaje.elo} ELO base`)
    .join('\n')
  return {
    titulo: `Top personajes de ${anime}`,
    texto: `Mi top 5 de ${anime} en AnimeShowdown:\n${resumen}\n\n¿A quién subirías votando?`,
    url: `/animes/${slug}`,
    alt: `Top 5 de personajes de ${anime} en AnimeShowdown`,
    fileName: `animeshowdown-${slug}.png`,
  }
}

export function buildPersonalAnimeTopContexto({ anime, slug, stats }) {
  const resumen = stats.top
    .slice(0, 5)
    .map((personaje, index) => `${index + 1}. ${personaje.nombre} x${personaje.count}`)
    .join('\n')
  return {
    titulo: `Mi top personal de ${anime}`,
    texto: resumen
      ? `Mi top personal de ${anime} en AnimeShowdown:\n${resumen}\n\n¿A quién subirías tú?`
      : `Estoy creando mi top personal de ${anime} en AnimeShowdown. ¿A quién votarías tú?`,
    url: `/animes/${slug}`,
    alt: `Tu top personal de ${anime} en AnimeShowdown`,
    fileName: `animeshowdown-${slug}-personal.png`,
  }
}

export function buildFeaturedAnimeDuelContexto({ anime, dueloDestacado }) {
  if (!dueloDestacado) return null
  const [a, b] = dueloDestacado
  return {
    titulo: `${a.nombre} vs ${b.nombre}`,
    texto: [
      `Duelo destacado de ${anime}: ${a.nombre} vs ${b.nombre}.`,
      `${a.nombre} lidera por ${Math.abs(a.elo - b.elo)} puntos de ELO base.`,
      '¿A quién subirías votando?',
    ].join('\n'),
    url: `/duelos/${a.slug}-vs-${b.slug}`,
    alt: `Duelo destacado de ${anime}: ${a.nombre} contra ${b.nombre}`,
    fileName: `animeshowdown-${a.slug}-vs-${b.slug}.png`,
  }
}
