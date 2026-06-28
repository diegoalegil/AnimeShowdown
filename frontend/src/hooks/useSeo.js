import { useEffect } from 'react'
import { API_BASE } from '../lib/api'

/**
 * Hook para set de meta tags por ruta.
 *
 * <p>Extiende {@code useDocumentTitle} setando además:
 * <ul>
 *   <li>{@code <meta name="description">} (sobrescribe el default del HTML).</li>
 *   <li>{@code <link rel="canonical">} apuntando a la URL canónica.</li>
 *   <li>OG tags (og:title, og:description, og:image, og:url, og:type).</li>
 *   <li>Twitter Card (twitter:title, twitter:description, twitter:image).</li>
 *   <li>{@code <meta name="robots" content="noindex">} si {@code noindex:true}.</li>
 * </ul>
 *
 * <p>Implementación sin react-helmet-async: mutación directa de
 * {@code document.head} en un useEffect. Al unmount restaura los valores
 * originales del HTML inicial. Sin context, sin deps externas, sin
 * SSR (las rutas SEO clave se materializan en build con `prerender-seo.mjs`;
 * este hook mantiene los metadatos correctos durante la navegación cliente).
 *
 * <p>Para JSON-LD usa {@code <JsonLd>} component (también gestiona limpieza).
 *
 * @param {Object} opts
 * @param {string} opts.title     título de pestaña + og:title (sin sufijo de marca)
 * @param {string} [opts.description] description (160 chars max recomendado)
 * @param {string} [opts.canonical]   URL canónica completa (default: location actual)
 * @param {string} [opts.image]   URL absoluta o relativa de la imagen OG (default: /logo.webp)
 * @param {string} [opts.type]    og:type (default 'website'; 'profile', 'article'...)
 * @param {boolean|string[]} [opts.hreflang] alternates solo para rutas traducidas de verdad
 * @param {boolean} [opts.noindex] añade meta robots noindex (login, perfil, admin)
 */
const BASE = 'AnimeShowdown'
const SITIO = 'https://animeshowdown.dev'
// Idiomas que se pueden activar por ruta si el contenido visible está
// traducido de verdad. Por defecto NO emitimos hreflang: muchas páginas core
// siguen teniendo copy español hardcodeado y prometer alternates sería ruido
// para crawlers.
const LANGS = ['es', 'en', 'ja']

// EN-first money pages: el prerender (scripts/prerender-seo.mjs → EN_COPY) ya
// emite la meta EN correcta (title/description/canonical self-referente/
// og:locale/<html lang="en">). Pero /en y /x montan el MISMO componente, que
// pasa a useSeo el copy ES de su gemela. Al hidratar, sin esto useSeo revertía
// el canonical de /en a la URL ES → Google canoniza /en a la versión ES y deja
// de indexar la variante inglesa (anula toda la Fase 1 EN-first). Aquí
// mantenemos las señales en inglés en /en. MANTENER EN SYNC con EN_COPY del
// prerender.
const EN_MONEY_COPY = {
  '/en': {
    title: 'AnimeShowdown — Anime character battle tournaments',
    description: 'Over 1000 anime characters, live ELO ranking and visual brackets. Vote for your favorites and move the meta every week.',
  },
  '/en/ranking': {
    title: 'Anime ELO ranking · AnimeShowdown',
    description: 'Top anime characters ranked by competitive signals, community votes and base ELO on AnimeShowdown.',
  },
  '/en/personajes': {
    title: 'Anime characters · AnimeShowdown',
    description: 'Browsable catalog of anime characters with profile, image, universe and ELO ranking on AnimeShowdown.',
  },
  '/en/animes': {
    title: 'Anime universes · AnimeShowdown',
    description: 'Anime universes with their roster, ELO top 10 and featured duels inside AnimeShowdown.',
  },
  '/en/comparar': {
    title: 'Compare anime characters · AnimeShowdown',
    description: 'Build a versus between two anime characters and compare ELO, popularity and community signals.',
  },
  '/en/votar': {
    title: 'Vote anime duels · AnimeShowdown',
    description: 'Anime duel arena: pick the winners, move the ELO ranking and discover new matchups.',
  },
  '/en/games': {
    title: 'Anime games · AnimeShowdown',
    description: 'AnimeShowdown daily games: Shadow Guess, Anime Reveal, AniGrid, Impostor Trial and ELO Duel.',
  },
  '/en/juegos/anime': {
    title: 'Anime games online · AnimeShowdown',
    description: 'Online anime games with daily challenges, ranking, ELO Duel and otaku knowledge quizzes.',
  },
}

export function useSeo({
  title,
  description,
  canonical,
  image,
  type = 'website',
  hreflang = false,
  noindex = false,
} = {}) {
  useEffect(() => {
    // Evaluado al montar: en una carga fresca prerenderizada (caso que importa
    // para crawlers) el pathname ya es el definitivo de la ruta.
    const path = typeof window !== 'undefined' ? window.location.pathname : '/'
    const enCopy = EN_MONEY_COPY[path] ?? null

    const tituloCompleto = enCopy
      ? enCopy.title
      : title
        ? `${title} · ${BASE}`
        : `${BASE} — Torneos de personajes de anime`
    const tituloOriginal = document.title
    document.title = tituloCompleto

    const desc = enCopy ? enCopy.description : description
    // En /en el canonical es self-referente (no la URL ES gemela) y el og:locale
    // es inglés, coherente con el HTML prerenderizado.
    const url = enCopy ? `${SITIO}${path}` : canonical ?? `${SITIO}${path}`
    const ogLocale = enCopy ? 'en_US' : 'es_ES'
    const ogLocaleAlt = enCopy ? 'es_ES' : 'en_US'
    const img = absolutizar(image ?? '/logo.webp')
    const hreflangLangs = hreflang === true
      ? LANGS
      : Array.isArray(hreflang)
        ? hreflang.filter((lang) => LANGS.includes(lang))
        : []

    const restoradores = [
      setMetaName('description', desc),
      setLink('canonical', url),
      setMetaProperty('og:title', tituloCompleto),
      setMetaProperty('og:description', desc),
      setMetaProperty('og:url', url),
      setMetaProperty('og:image', img),
      setMetaProperty('og:type', type),
      setMetaProperty('og:site_name', BASE),
      setMetaProperty('og:locale', ogLocale),
      setMetaProperty('og:locale:alternate', ogLocaleAlt),
      setMetaName('twitter:card', 'summary_large_image'),
      setMetaName('twitter:title', tituloCompleto),
      setMetaName('twitter:description', desc),
      setMetaName('twitter:image', img),
      noindex
        ? setMetaName('robots', 'noindex,nofollow')
        : setMetaName('robots', null),
      // Hreflang: solo si la ruta lo pide explícitamente y no es noindex.
      ...(noindex || hreflangLangs.length === 0
        ? []
        : hreflangLangs.map((lang) =>
            setLinkAlternate(lang, withLangParam(url, lang)),
          )),
      ...(noindex || hreflangLangs.length === 0 ? [] : [setLinkAlternate('x-default', withLangParam(url, 'es'))]),
    ]

    return () => {
      document.title = tituloOriginal
      for (const restore of restoradores) restore()
    }
  }, [title, description, canonical, image, type, hreflang, noindex])
}

function absolutizar(src) {
  if (!src) return src
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src
  }
  // Las imágenes OG dinámicas las sirve el API, no el front: con SITIO
  // (animeshowdown.dev) devuelven 404 — el dominio del front no expone /api.
  // Hay que absolutizarlas contra API_BASE (api.animeshowdown.dev).
  if (src.startsWith('/api/')) {
    return `${API_BASE}${src}`
  }
  return `${SITIO}${src.startsWith('/') ? '' : '/'}${src}`
}

/**
 * Añade {@code ?lang=X} a una URL sin duplicar el param si ya existe.
 * Usado por hreflang para que cada alternate apunte a la misma página
 * con el idioma "fijado" como query param. El frontend respeta el
 * {@code ?lang} sobre la preferencia de localStorage para que crawlers
 * que entran via hreflang aterricen en el idioma correcto.
 *
 * <p>El soporte de {@code ?lang} en el cliente todavía es parcial: si
 * un crawler ignora el parámetro, i18next cae a su detector normal y la
 * página sigue siendo accesible.
 */
function withLangParam(url, lang) {
  try {
    const u = new URL(url)
    u.searchParams.set('lang', lang)
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Setea {@code <link rel="alternate" hreflang="X" href="Y">}. Devuelve
 * una función que restaura el estado anterior (igual que los otros
 * setters de meta tags).
 */
function setLinkAlternate(hreflang, href) {
  const sel = `link[rel="alternate"][hreflang="${hreflang}"]`
  let el = document.head.querySelector(sel)
  let creado = false
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'alternate')
    el.setAttribute('hreflang', hreflang)
    document.head.appendChild(el)
    creado = true
  }
  const prev = el.getAttribute('href')
  if (href) el.setAttribute('href', href)
  return () => {
    if (creado) {
      el.remove()
    } else if (prev != null) {
      el.setAttribute('href', prev)
    } else {
      el.removeAttribute('href')
    }
  }
}

/**
 * Setea o crea {@code <meta name="X" content="Y">} y devuelve una función
 * que restaura el estado anterior (valor previo si existía, eliminación
 * si lo creamos nosotros).
 */
function setMetaName(name, content) {
  return setMeta(`meta[name="${name}"]`, () => {
    const el = document.createElement('meta')
    el.setAttribute('name', name)
    return el
  }, content)
}

function setMetaProperty(property, content) {
  return setMeta(`meta[property="${property}"]`, () => {
    const el = document.createElement('meta')
    el.setAttribute('property', property)
    return el
  }, content)
}

function setLink(rel, href) {
  const sel = `link[rel="${rel}"]`
  let el = document.head.querySelector(sel)
  let creado = false
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
    creado = true
  }
  const prev = el.getAttribute('href')
  if (href) el.setAttribute('href', href)
  else el.removeAttribute('href')
  return () => {
    if (creado) {
      el.remove()
    } else if (prev != null) {
      el.setAttribute('href', prev)
    } else {
      el.removeAttribute('href')
    }
  }
}

function setMeta(selector, factory, content) {
  let el = document.head.querySelector(selector)
  let creado = false
  if (!el) {
    if (!content) return () => {} // nada que crear
    el = factory()
    document.head.appendChild(el)
    creado = true
  }
  const prev = el.getAttribute('content')
  if (content) {
    el.setAttribute('content', content)
  } else if (creado) {
    el.remove()
  } else {
    el.removeAttribute('content')
  }
  return () => {
    if (creado) {
      if (el.parentNode) el.remove()
    } else if (prev != null) {
      el.setAttribute('content', prev)
    } else {
      el.removeAttribute('content')
    }
  }
}
