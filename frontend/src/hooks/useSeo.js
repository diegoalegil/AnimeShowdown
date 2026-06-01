import { useEffect } from 'react'

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
 * SSR (la SPA renderiza tras JS, los crawlers de Google ejecutan JS
 * desde 2018 — para previews social usamos OG image dinámica server-side
 * de la capa correspondiente).
 *
 * <p>Para JSON-LD usa {@code <JsonLd>} component (también gestiona limpieza).
 *
 * @param {Object} opts
 * @param {string} opts.title     título de pestaña + og:title (sin sufijo de marca)
 * @param {string} [opts.description] description (160 chars max recomendado)
 * @param {string} [opts.canonical]   URL canónica completa (default: location actual)
 * @param {string} [opts.image]   URL absoluta o relativa de la imagen OG (default: /logo.webp)
 * @param {string} [opts.type]    og:type (default 'website'; 'profile', 'article'...)
 * @param {boolean|string[]} [opts.hreflang] emite alternates solo en rutas
 *     realmente localizadas; true usa todos los idiomas soportados.
 * @param {boolean} [opts.noindex] añade meta robots noindex (login, perfil, admin)
 */
const BASE = 'AnimeShowdown'
const SITIO = 'https://animeshowdown.dev'
// Idiomas soportados por el selector. Hreflang NO se emite por defecto:
// muchas rutas tienen shell traducido pero contenido principal en ES, así que
// cada página debe declararse localizada antes de prometer alternates SEO.
const LANGS = ['es', 'en', 'ja']

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
    const tituloCompleto = title
      ? `${title} · ${BASE}`
      : `${BASE} — Torneos de personajes de anime`
    const tituloOriginal = document.title
    document.title = tituloCompleto

    const url = canonical ?? `${SITIO}${window.location.pathname}`
    const img = absolutizar(image ?? '/logo.webp')
    const alternateLangs = noindex ? [] : normalizeHreflangLangs(hreflang)

    const restoradores = [
      setMetaName('description', description),
      setLink('canonical', url),
      setMetaProperty('og:title', tituloCompleto),
      setMetaProperty('og:description', description),
      setMetaProperty('og:url', url),
      setMetaProperty('og:image', img),
      setMetaProperty('og:type', type),
      setMetaProperty('og:site_name', BASE),
      setMetaProperty('og:locale', 'es_ES'),
      setMetaProperty('og:locale:alternate', 'en_US'),
      setMetaName('twitter:card', 'summary_large_image'),
      setMetaName('twitter:title', tituloCompleto),
      setMetaName('twitter:description', description),
      setMetaName('twitter:image', img),
      noindex
        ? setMetaName('robots', 'noindex,nofollow')
        : setMetaName('robots', null),
      // Hreflang: opt-in por página. Si una ruta mezcla copy ES con shell
      // traducido, emitir alternates engaña a crawlers y usuarios.
      ...alternateLangs.map((lang) =>
        setLinkAlternate(lang, withLangParam(url, lang)),
      ),
      ...(alternateLangs.length > 0
        ? [setLinkAlternate('x-default', withLangParam(url, 'es'))]
        : []),
    ]

    return () => {
      document.title = tituloOriginal
      for (const restore of restoradores) restore()
    }
  }, [title, description, canonical, image, type, hreflang, noindex])
}

function normalizeHreflangLangs(hreflang) {
  if (hreflang === true) return LANGS
  if (!Array.isArray(hreflang)) return []
  return hreflang.filter((lang) => LANGS.includes(lang))
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
