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
//     anime, torneo, rankings curados, ranking global, duelos compartibles
//     `/duelos/A-vs-B`, retos directos `/votar?personaje=&rival=` y mi-ranking);
//     el resto conserva el OG por defecto del index.html.
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

// ===========================================================================
// CSP consciente del entorno (preview vs produccion)
// ===========================================================================
// La CSP estatica de _headers solo permite el API canonico en connect-src, asi
// que los deploys de PREVIEW (que apuntan VITE_API_URL al backend de preview en
// Railway) no podian cargar catalogo/auth/WS. Aqui se amplia connect-src con el
// origen de preview SOLO cuando el host NO es el de produccion. Produccion queda
// EXACTAMENTE igual (no se toca su CSP) y, ante cualquier anomalia, se degrada a
// no-op (devuelve la respuesta original sin modificar).
const PROD_HOSTS = new Set(['animeshowdown.dev', 'www.animeshowdown.dev'])
const PREVIEW_API_ORIGINS =
  'https://animeshowdown-production-a9f4.up.railway.app wss://animeshowdown-production-a9f4.up.railway.app'

function esHostDePreview(hostname) {
  return !PROD_HOSTS.has(hostname)
}

// Devuelve una Response con connect-src ampliado para incluir el API de preview.
// No-op seguro si no hay CSP, no hay connect-src, o ya esta ampliada.
function conCspDePreview(response) {
  const csp = response.headers.get('content-security-policy')
  if (!csp || !/connect-src/.test(csp) || csp.includes('up.railway.app')) {
    return response
  }
  const nuevoCsp = csp.replace(
    /connect-src ([^;]*)/,
    (_match, fuentes) => `connect-src ${fuentes.trim()} ${PREVIEW_API_ORIGINS}`,
  )
  const headers = new Headers(response.headers)
  headers.set('content-security-policy', nuevoCsp)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function humanizarSlug(slug) {
  return slug
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// OG de un duelo A vs B, reutilizado por `/duelos/A-vs-B` (landing) y por el
// deep-link de reto `/votar?personaje=A&rival=B`. La imagen la sirve el backend
// en /api/og/duelo/{A}/vs/{B}.png (render server-side con ambas fotos + VS).
function ogDuelo(slugA, slugB, apiBase, esReto) {
  const nombreA = humanizarSlug(slugA)
  const nombreB = humanizarSlug(slugB)
  return {
    image: `${apiBase}/api/og/duelo/${encodeURIComponent(slugA)}/vs/${encodeURIComponent(slugB)}.png`,
    title: `${nombreA} vs ${nombreB} · AnimeShowdown`,
    description: esReto
      ? `Te reto a este duelo: ${nombreA} vs ${nombreB}. Vota quién gana en AnimeShowdown y mueve el ranking.`
      : `Duelo abierto: ${nombreA} vs ${nombreB}. Compara ELO, vota quién gana y mueve el ranking en AnimeShowdown.`,
  }
}

// Devuelve { image, title, description } para las rutas con OG propio, o null.
// Recibe el `URL` completo: la mayoría de rutas resuelven por pathname, pero los
// retos directos (`/votar`) dependen de los query params (personaje/rival/anime).
export function ogParaRuta(url, apiBase) {
  const pathname = url.pathname
  const params = url.searchParams

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
  // Landing de duelo compartible: /duelos/A-vs-B. El slug del par puede contener
  // guiones, así que se separa por el patrón `-vs-` (igual que DueloVersusPage).
  const dueloPath = pathname.match(/^\/duelos\/([^/]+)\/?$/)
  if (dueloPath) {
    const par = decodeURIComponent(dueloPath[1]).match(/^(.+)-vs-(.+)$/)
    if (par && par[1] !== par[2]) {
      return ogDuelo(par[1], par[2], apiBase, false)
    }
  }
  // Perfil público de usuario: /u/{username} (y /u/{username}/logros). El gancho
  // viral del B7: compartir un perfil renderiza su OG (avatar + stats). El
  // username es literal (no se humaniza como los slugs de personaje/anime).
  const usuario = pathname.match(/^\/u\/([^/]+)(?:\/logros)?\/?$/)
  if (usuario) {
    const username = decodeURIComponent(usuario[1])
    return {
      image: `${apiBase}/api/og/usuario/${encodeURIComponent(username)}.png`,
      title: `${username} · AnimeShowdown`,
      description: `Top personajes, logros y ranking de ${username}. Síguele en AnimeShowdown.`,
    }
  }
  // Reto directo a la arena: /votar?personaje=A[&rival=B] o ?anime=X.
  // Es el deep-link "Reta a un amigo": el receptor aterriza votando ese mismo duelo.
  if (pathname === '/votar' || pathname === '/votar/') {
    const slugA = params.get('personaje')
    const slugB = params.get('rival')
    const anime = params.get('anime')
    if (slugA && slugB && slugA !== slugB) {
      return ogDuelo(slugA, slugB, apiBase, true)
    }
    if (slugA) {
      const nombre = humanizarSlug(slugA)
      return {
        image: `${apiBase}/api/og/personaje/${encodeURIComponent(slugA)}.png`,
        title: `Reto a ${nombre} · AnimeShowdown`,
        description: `Te reto a un duelo contra ${nombre} en AnimeShowdown. Vota quién gana y mueve el ranking.`,
      }
    }
    if (anime) {
      const nombre = humanizarSlug(anime)
      return {
        image: `${apiBase}/api/og/anime/${encodeURIComponent(anime)}.png`,
        title: `Duelos de ${nombre} · AnimeShowdown`,
        description: `Vota duelos internos de ${nombre} en AnimeShowdown y mueve su ranking.`,
      }
    }
    // /votar sin params → OG genérico (return null al final).
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
  if (pathname === '/ranking' || pathname === '/ranking/') {
    return {
      image: `${apiBase}/api/og/ranking.png`,
      title: 'Ranking competitivo · AnimeShowdown',
      description: 'Quién domina AnimeShowdown: ranking de personajes anime por votos reales de la comunidad.',
    }
  }
  // Recap personal: el ranking local de la sesión no es renderizable server-side,
  // así que el share reutiliza la OG del ranking global (genérica pero on-brand).
  if (pathname === '/mi-ranking' || pathname === '/mi-ranking/') {
    return {
      image: `${apiBase}/api/og/ranking.png`,
      title: 'Mi ranking anime · AnimeShowdown',
      description: 'Mi top personal de personajes anime en AnimeShowdown. Crea el tuyo votando duelos.',
    }
  }
  const tierList = pathname.match(/^\/tier-lists\/([^/]+)\/?$/)
  if (tierList) {
    const slug = decodeURIComponent(tierList[1])
    const nombre = humanizarSlug(slug)
    return {
      image: `${apiBase}/api/og/tier-list/${encodeURIComponent(slug)}.png`,
      title: `${nombre} · AnimeShowdown`,
      description: `Tier list anime ${nombre}. Crea y comparte la tuya en AnimeShowdown.`,
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

    // En deploys de preview se amplia connect-src para el API de preview;
    // produccion (host canonico) queda intacta.
    const base = esHostDePreview(url.hostname) ? conCspDePreview(response) : response

    const apiBase = (context.env && context.env.OG_API_BASE) || DEFAULT_API_BASE
    const og = ogParaRuta(url, apiBase)
    if (!og) return base

    // og:url y canonical: el HTML estatico apunta al home; en una ruta dinamica
    // hay que reescribirlos a la URL real, o todo lo compartido sale como el
    // home. Las twitter cards (name="twitter:*") tambien quedaban sin tocar, asi
    // que X mostraba el titulo/imagen por defecto en cada perfil/duelo/top (A14).
    const canonical = `${url.origin}${url.pathname}`

    return new HTMLRewriter()
      .on('meta[property="og:image"]', new SetContent(og.image))
      .on('meta[property="og:title"]', new SetContent(og.title))
      .on('meta[property="og:description"]', new SetContent(og.description))
      .on('meta[property="og:url"]', new SetContent(canonical))
      .on('meta[name="twitter:image"]', new SetContent(og.image))
      .on('meta[name="twitter:title"]', new SetContent(og.title))
      .on('meta[name="twitter:description"]', new SetContent(og.description))
      .on('meta[name="description"]', new SetContent(og.description))
      .on('title', new SetText(og.title))
      .transform(base)
  } catch {
    // Fail-safe: ante cualquier error, servir el HTML original sin modificar.
    return response
  }
}
