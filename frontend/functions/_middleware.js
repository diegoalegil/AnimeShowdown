// ===========================================================================
// Cloudflare Pages Function · OG por ruta (TRACK G)
// ===========================================================================
//
// useSeo es client-side: los crawlers sociales (que no ejecutan JS) solo ven
// el OG genérico del index.html estático (el logo). Este middleware corre en el
// edge de Cloudflare y reescribe las meta OG del HTML por TIPO de ruta,
// reutilizando las imágenes OG que el backend ya genera en /api/og/*.
//
// DISEÑO DEFENSIVO (alto blast radius: corre en CADA request):
//   - Solo toca respuestas text/html; assets y /api pasan intactos.
//   - Solo reescribe rutas mapeadas (personaje, anime, ranking interno de
//     anime, torneo, rankings curados y ranking global); el resto conserva
//     el OG por defecto del index.html.
//   - Cualquier error → devuelve la respuesta original sin tocar (try/catch).
//
// VERIFICAR EN PREVIEW DE CF antes de confiar en producción (no es testeable
// en local: `vite dev` no ejecuta Pages Functions). Si el "root directory" del
// proyecto en Cloudflare NO es `frontend/`, mover este archivo a `functions/`
// en la raíz que corresponda — si la ruta no coincide, el middleware
// simplemente no corre (degradación segura: OG genérico, sin romper nada).
//
// Config opcional por variable de entorno de Pages:
//   OG_API_BASE  (default https://api.animeshowdown.dev)
// ===========================================================================

/* global HTMLRewriter */
// ^ HTMLRewriter es un global del runtime de Cloudflare Workers/Pages.

const DEFAULT_API_BASE = 'https://api.animeshowdown.dev'

function humanizarSlug(slug) {
  return slug
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Devuelve { image, title, description } para las rutas con OG propio, o null.
function ogParaRuta(pathname, apiBase) {
  const personaje = pathname.match(/^\/personajes\/([^/]+)\/?$/)
  if (personaje) {
    const slug = decodeURIComponent(personaje[1])
    const nombre = humanizarSlug(slug)
    return {
      image: `${apiBase}/api/og/personaje/${encodeURIComponent(slug)}.png`,
      title: `${nombre} · AnimeShowdown`,
      description: `Ficha de ${nombre} en AnimeShowdown: ranking ELO, anime de origen y duelos. Vota y mueve el ranking.`,
    }
  }
  // Ranking interno de un anime: /animes/{slug}/ranking (antes que /animes/{slug}).
  const animeRanking = pathname.match(/^\/animes\/([^/]+)\/ranking\/?$/)
  if (animeRanking) {
    const slug = decodeURIComponent(animeRanking[1])
    const nombre = humanizarSlug(slug)
    return {
      image: `${apiBase}/api/og/anime/${encodeURIComponent(slug)}.png`,
      title: `Ranking de ${nombre} · AnimeShowdown`,
      description: `Ranking de personajes de ${nombre} por votos de la comunidad en AnimeShowdown. Vota y mueve la tabla.`,
    }
  }
  // Ficha de un universo anime: /animes/{slug}.
  const anime = pathname.match(/^\/animes\/([^/]+)\/?$/)
  if (anime) {
    const slug = decodeURIComponent(anime[1])
    const nombre = humanizarSlug(slug)
    return {
      image: `${apiBase}/api/og/anime/${encodeURIComponent(slug)}.png`,
      title: `${nombre} · AnimeShowdown`,
      description: `Personajes de ${nombre} en AnimeShowdown: ranking ELO, duelos y votos de la comunidad.`,
    }
  }
  // Torneo: /torneos/{slug} (excluye la ruta de creación, que es privada/noindex).
  const torneo = pathname.match(/^\/torneos\/([^/]+)\/?$/)
  if (torneo && decodeURIComponent(torneo[1]) !== 'crear') {
    const slug = decodeURIComponent(torneo[1])
    const nombre = humanizarSlug(slug)
    return {
      image: `${apiBase}/api/og/torneo/${encodeURIComponent(slug)}.png`,
      title: `${nombre} · AnimeShowdown`,
      description: `Bracket del torneo ${nombre} en AnimeShowdown. Sigue los duelos y vota a tus personajes.`,
    }
  }
  // Landings de ranking curadas (alta intención SEO): /rankings/{slug}.
  const rankingLanding = pathname.match(/^\/rankings\/([^/]+)\/?$/)
  if (rankingLanding) {
    const slug = decodeURIComponent(rankingLanding[1])
    const nombre = humanizarSlug(slug)
    return {
      image: `${apiBase}/api/og/ranking.png`,
      title: `${nombre} · AnimeShowdown`,
      description: `${nombre}: ranking de personajes anime votado por la comunidad de AnimeShowdown.`,
    }
  }
  if (pathname === '/ranking') {
    return {
      image: `${apiBase}/api/og/ranking.png`,
      title: 'Ranking competitivo · AnimeShowdown',
      description: 'Quién domina AnimeShowdown: ranking de personajes anime por votos reales de la comunidad.',
    }
  }
  return null
}

class SetContent {
  constructor(value) {
    this.value = value
  }
  element(el) {
    el.setAttribute('content', this.value)
  }
}

class SetText {
  constructor(value) {
    this.value = value
  }
  element(el) {
    el.setInnerContent(this.value)
  }
}

export async function onRequest(context) {
  const response = await context.next()
  try {
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return response

    const url = new URL(context.request.url)
    const apiBase = (context.env && context.env.OG_API_BASE) || DEFAULT_API_BASE
    const og = ogParaRuta(url.pathname, apiBase)
    if (!og) return response

    return new HTMLRewriter()
      .on('meta[property="og:image"]', new SetContent(og.image))
      .on('meta[property="og:title"]', new SetContent(og.title))
      .on('meta[property="og:description"]', new SetContent(og.description))
      .on('meta[name="description"]', new SetContent(og.description))
      .on('title', new SetText(og.title))
      .transform(response)
  } catch {
    // Fail-safe: ante cualquier error, servir el HTML original sin modificar.
    return response
  }
}
