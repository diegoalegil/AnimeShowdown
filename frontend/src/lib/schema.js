/**
 * Factory functions de schema.org JSON-LD por tipo de página.
 *
 * <p>Cada función devuelve un objeto plano que se pasa como prop al
 * componente {@code <JsonLd>}. Validar con Google Rich Results Test
 * (https://search.google.com/test/rich-results) tras cada cambio
 * importante de schema — algunos cambios silenciosos rompen el rich
 * snippet.
 *
 * <p>Decisiones de modelado:
 * <ul>
 *   <li>Personaje: usamos {@code Person} (no {@code FictionalCharacter}
 *       todavía soportado de forma irregular por Google). {@code additionalProperty}
 *       lleva ELO base, votos registrados y señales de ranking como datos
 *       interpretables sin inventar un tipo propio.</li>
 *   <li>Torneo: {@code SportsEvent} con {@code competitor[]} = personajes
 *       del bracket. El status mapea a {@code eventStatus} de schema.org.</li>
 *   <li>Anime: {@code TVSeries} con {@code character[]} referenciando
 *       los personajes del catálogo de ese anime.</li>
 * </ul>
 */

import { API_BASE } from './api'

const SITIO = 'https://animeshowdown.dev'

function abs(path) {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  // Las imágenes OG dinámicas las sirve el API (api.animeshowdown.dev), no el
  // dominio del front: con SITIO devuelven 404 en el JSON-LD social.
  if (path.startsWith('/api/')) return `${API_BASE}${path}`
  return `${SITIO}${path.startsWith('/') ? '' : '/'}${path}`
}

function slugifySchemaName(value) {
  if (typeof value !== 'string') return ''
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Schema {@code WebSite} — para la home. Habilita el sitelinks search box
 * si Google decide mostrarlo (no garantizado, depende de autoridad de dominio).
 */
export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AnimeShowdown',
    url: SITIO,
    inLanguage: 'es-ES',
    description:
      'Duelos cara a cara, juegos diarios y rankings competitivos de personajes de anime.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITIO}/personajes?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Schema {@code Organization} — la entidad de marca AnimeShowdown. Google la
 * usa para asociar nombre + logo en resultados de marca (y, con suficiente
 * autoridad, el Knowledge Panel / logo en SERP). El {@code @id} le da identidad
 * estable para que WebSite, breadcrumbs, etc. puedan referenciarla en el futuro.
 * El logo reusa {@code /logo.webp} (el mismo del OG). {@code sameAs} enlazaría
 * los perfiles sociales oficiales — se omite hoy porque la marca aún no tiene
 * redes públicas (un sameAs vacío no aporta y ensucia la validación); añadir el
 * array aquí cuando existan los conecta a la entidad.
 */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITIO}/#organization`,
    name: 'AnimeShowdown',
    url: SITIO,
    logo: abs('/logo.webp'),
    description:
      'Duelos cara a cara, juegos diarios y rankings ELO competitivos de personajes de anime.',
  }
}

/**
 * Schema {@code Person} para un personaje individual.
 *
 * @param personaje objeto del catálogo cliente-side con {slug, nombre, anime, descripcion, imagen}
 * @param stats opcional con {elo, wins, losses}
 * @param ranking opcional con {rankGlobal, rankAnime, totalAnime, totalCatalogo}
 */
export function personajeSchema(personaje, stats, ranking = {}) {
  if (!personaje) return null
  const url = abs(`/personajes/${personaje.slug}`)
  const imagen = abs(personaje.imagen ?? personaje.imagenUrl)
  const animeSlug = slugifySchemaName(personaje.anime)
  const properties = []
  if (stats && Number.isFinite(stats.elo)) {
    properties.push(
      {
        '@type': 'PropertyValue',
        name: 'ELO base',
        value: stats.elo,
      },
      {
        '@type': 'PropertyValue',
        name: 'Votos registrados',
        value: Number(stats.wins ?? 0) + Number(stats.losses ?? 0),
      },
    )
  }
  if (Number.isFinite(ranking.rankGlobal) && ranking.rankGlobal > 0) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Ranking global ELO base',
      value: ranking.rankGlobal,
      ...(Number.isFinite(ranking.totalCatalogo)
        ? { unitText: `${ranking.totalCatalogo} personajes` }
        : {}),
    })
  }
  if (Number.isFinite(ranking.rankAnime) && ranking.rankAnime > 0) {
    properties.push({
      '@type': 'PropertyValue',
      name: `Ranking en ${personaje.anime}`,
      value: ranking.rankAnime,
      ...(Number.isFinite(ranking.totalAnime)
        ? { unitText: `${ranking.totalAnime} personajes del anime` }
        : {}),
    })
  }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#personaje`,
    identifier: personaje.slug,
    name: personaje.nombre,
    url,
    image: imagen,
    description: personaje.descripcion,
    disambiguatingDescription: `${personaje.nombre} es un personaje de ${personaje.anime} representado en el catálogo competitivo de AnimeShowdown.`,
    additionalType: 'https://schema.org/FictionalCharacter',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `${personaje.nombre} de ${personaje.anime} en AnimeShowdown`,
      isPartOf: {
        '@type': 'WebSite',
        name: 'AnimeShowdown',
        url: SITIO,
      },
    },
    affiliation: {
      '@type': 'CreativeWorkSeries',
      name: personaje.anime,
      url: animeSlug ? abs(`/animes/${animeSlug}`) : undefined,
    },
    potentialAction: {
      '@type': 'VoteAction',
      target: abs(`/votar?personaje=${encodeURIComponent(personaje.slug)}`),
      name: `Votar a ${personaje.nombre}`,
    },
  }
  if (personaje.sameAs || personaje.wikidataUrl || personaje.malUrl) {
    schema.sameAs = [personaje.sameAs, personaje.wikidataUrl, personaje.malUrl]
      .flat()
      .filter(Boolean)
  }
  if (properties.length > 0) schema.additionalProperty = properties
  return schema
}

/**
 * Schema {@code CreativeWorkSeries} para una ficha de anime (/animes/:slug).
 *
 * @param animeData objeto agregado de getAnimePorSlug con {anime, slug, personajes, total, topElo}
 */
export function animeSeriesSchema(animeData) {
  if (!animeData) return null
  const slug = animeData.slug || slugifySchemaName(animeData.anime)
  const url = abs(`/animes/${slug}`)
  const image = abs(animeData.image || `/assets/anime-banners/${slug}.webp`)
  const personajes = Array.isArray(animeData.personajes)
    ? animeData.personajes
    : []
  const character = personajes.slice(0, 80).map((p) => ({
    '@type': 'Person',
    '@id': abs(`/personajes/${p.slug}#personaje`),
    name: p.nombre,
    url: abs(`/personajes/${p.slug}`),
    image: abs(p.imagen ?? p.imagenUrl),
    additionalType: 'https://schema.org/FictionalCharacter',
  }))
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': `${url}#anime`,
    additionalType: 'https://schema.org/CreativeWorkSeries',
    identifier: slug,
    name: animeData.anime,
    alternateName: Array.isArray(animeData.aliases) && animeData.aliases.length
      ? animeData.aliases
      : undefined,
    url,
    image,
    description:
      animeData.description ||
      `Ficha de ${animeData.anime} en AnimeShowdown con ${Number(animeData.total ?? personajes.length)} personajes, ranking ELO base y duelos destacados.`,
    genre: ['Anime', 'Ranking competitivo'],
    inLanguage: 'ja',
    isAccessibleForFree: true,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `${animeData.anime} en AnimeShowdown`,
      inLanguage: 'es-ES',
      isPartOf: {
        '@type': 'WebSite',
        name: 'AnimeShowdown',
        url: SITIO,
      },
    },
    character,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Personajes en AnimeShowdown',
        value: Number(animeData.total ?? personajes.length),
      },
    ],
  }
  if (Array.isArray(animeData.aliases) && animeData.aliases.length) {
    schema.keywords = animeData.aliases.join(', ')
  }
  if (Number.isFinite(animeData.numberOfEpisodes)) {
    schema.numberOfEpisodes = animeData.numberOfEpisodes
  }
  if (Number.isFinite(animeData.eloPromedio)) {
    schema.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'ELO promedio base',
      value: animeData.eloPromedio,
    })
  }
  if (animeData.topElo) {
    schema.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Top ELO base',
      value: animeData.topElo.elo,
      description: `${animeData.topElo.nombre} lidera el ELO base de ${animeData.anime}.`,
    })
  }
  return schema
}

/**
 * Schema {@code SportsEvent} para un torneo. Mapea estado a {@code eventStatus}
 * de schema.org (los crawlers entienden mejor los enums oficiales).
 *
 * @param torneo {nombre, slug, descripcion, estado, fechaInicio, fechaFinalizacion}
 * @param competidores array de personajes {nombre, slug, imagen}
 * @param options opcional con {image}
 */
export function torneoSchema(torneo, competidores = [], options = {}) {
  if (!torneo) return null
  const url = abs(`/torneos/${torneo.slug}`)
  const image = abs(options.image || `/api/og/torneo/${torneo.slug}.png`)
  const eventStatus = mapEstadoEvento(torneo.estado)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `${url}#torneo`,
    identifier: torneo.slug,
    name: torneo.nombre,
    url,
    image,
    description:
      torneo.descripcion ||
      `Bracket de ${competidores.length} personajes de anime cara a cara.`,
    sport: 'Anime character voting',
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    isAccessibleForFree: true,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `${torneo.nombre} en AnimeShowdown`,
      inLanguage: 'es-ES',
      isPartOf: {
        '@type': 'WebSite',
        name: 'AnimeShowdown',
        url: SITIO,
      },
    },
    location: {
      '@type': 'VirtualLocation',
      url,
    },
    organizer: {
      '@type': 'Organization',
      name: 'AnimeShowdown',
      url: SITIO,
    },
    offers: {
      '@type': 'Offer',
      url,
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
  }
  if (torneo.fechaInicio) schema.startDate = torneo.fechaInicio
  if (torneo.fechaFinalizacion) schema.endDate = torneo.fechaFinalizacion
  if (competidores.length > 0) {
    schema.competitor = competidores.map((c) => ({
      '@type': 'Person',
      '@id': abs(`/personajes/${c.slug}#personaje`),
      name: c.nombre,
      url: abs(`/personajes/${c.slug}`),
      // El catálogo cliente usa {imagen}; el DTO backend usa {imagenUrl}.
      // Aceptamos ambos para que esta factory sirva en cualquiera de los
      // dos contextos sin tener que mapear antes.
      image: abs(c.imagen ?? c.imagenUrl),
      additionalType: 'https://schema.org/FictionalCharacter',
    }))
  }
  return schema
}

/**
 * Schema {@code Event} para eventos temporales versionados en frontend.
 *
 * @param evento {titulo, slug, descripcionCorta, inicioISO, finISO}
 * @param participantes array de personajes del evento
 * @param options opcional con {estado, image}
 */
export function eventoSchema(evento, participantes = [], options = {}) {
  if (!evento) return null
  const url = abs(`/eventos/${evento.slug}`)
  // No existe endpoint OG para eventos (/api/og/evento/* devuelve 500): usar la
  // imagen explícita si la hay, o el logo de marca como fallback estable.
  const image = abs(options.image || '/logo.webp')
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${url}#evento`,
    identifier: evento.slug,
    name: evento.titulo,
    url,
    image,
    description: evento.descripcionCorta,
    eventStatus: mapEstadoEvento(options.estado),
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    isAccessibleForFree: true,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `${evento.titulo} en AnimeShowdown`,
      inLanguage: 'es-ES',
      isPartOf: {
        '@type': 'WebSite',
        name: 'AnimeShowdown',
        url: SITIO,
      },
    },
    location: {
      '@type': 'VirtualLocation',
      url,
    },
    organizer: {
      '@type': 'Organization',
      name: 'AnimeShowdown',
      url: SITIO,
    },
    offers: {
      '@type': 'Offer',
      url,
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      validFrom: evento.inicioISO,
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Participantes en AnimeShowdown',
        value: participantes.length,
      },
    ],
  }
  if (evento.inicioISO) schema.startDate = evento.inicioISO
  if (evento.finISO) schema.endDate = evento.finISO
  if (participantes.length > 0) {
    schema.performer = participantes.slice(0, 40).map((p) => ({
      '@type': 'Person',
      '@id': abs(`/personajes/${p.slug}#personaje`),
      name: p.nombre,
      url: abs(`/personajes/${p.slug}`),
      image: abs(p.imagen ?? p.imagenUrl),
      additionalType: 'https://schema.org/FictionalCharacter',
    }))
  }
  return schema
}

/**
 * Schema {@code CollectionPage} para la lista de animes (/animes). No usamos
 * TVSeries individuales porque no hay rutas {@code /animes/{slug}} de detalle
 * todavía — eso queda para una iteración futura.
 *
 * @param animesList array de strings con los nombres de animes
 */
export function animesListSchema(animesList = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Animes en AnimeShowdown',
    url: abs('/animes'),
    description: `Catálogo de ${animesList.length} animes representados en AnimeShowdown.`,
    isPartOf: { '@type': 'WebSite', name: 'AnimeShowdown', url: SITIO },
  }
}

/**
 * Schema {@code CollectionPage} con {@code ItemList} de logros.
 * Cada badge entra como {@code Achievement} (subtype de CreativeWork con
 * mejor cobertura semántica que Thing) — el frontend lo pinta además con
 * Microdata inline en cada card.
 *
 * @param logros array de {codigo, nombre, descripcion}
 */
export function logrosCollectionSchema(logros = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Catálogo de logros — AnimeShowdown',
    url: abs('/logros'),
    description: `Los ${logros.length} logros que puedes desbloquear en AnimeShowdown — votos, predicciones, torneos y rachas diarias.`,
    isPartOf: { '@type': 'WebSite', name: 'AnimeShowdown', url: SITIO },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: logros.length,
      itemListElement: logros.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Achievement',
          name: l.nombre,
          description: l.descripcion,
          identifier: l.codigo,
        },
      })),
    },
  }
}

/**
 * Schema {@code DefinedTermSet}. Glosario de términos
 * otaku. Cada término individual va como {@code DefinedTerm} dentro del
 * mainEntity para captura long-tail SEO ("qué es tsundere", "qué es isekai").
 *
 * @param items array de {termino, definicion, ejemplos?: string[]}
 */
export function definedTermSetSchema(items, nombreGlosario = 'Glosario otaku') {
  if (!items || items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: nombreGlosario,
    inLanguage: 'es-ES',
    hasDefinedTerm: items.map((it) => ({
      '@type': 'DefinedTerm',
      name: it.termino,
      description: it.definicion,
      inDefinedTermSet: nombreGlosario,
    })),
  }
}

/**
 * Schema {@code FAQPage}. Cada item produce un acordeón
 * en el rich snippet de Google si la página alcanza autoridad suficiente.
 * Las respuestas se serializan como texto plano (HTML básico se permite
 * pero Google solo renderiza un subset; preferimos plain text).
 *
 * @param items array de {pregunta, respuesta}
 */
export function faqPageSchema(items) {
  if (!items || items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.pregunta,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.respuesta,
      },
    })),
  }
}

/**
 * Schema {@code CollectionPage} + {@code ItemList} para rankings públicos.
 * Útil para páginas como /animes/{slug}/ranking donde el contenido central
 * es una lista ordenada y estable de entidades con posición.
 *
 * @param {Object} opts
 * @param {string} opts.name nombre de la lista
 * @param {string} opts.path URL canónica relativa
 * @param {string} opts.description descripción indexable
 * @param {Array} opts.items items con {name, path, image?, score?, scoreLabel?}
 */
export function rankingItemListSchema({
  name,
  path,
  description,
  items = [],
} = {}) {
  if (!name || !path || !items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: abs(path),
    description,
    isPartOf: { '@type': 'WebSite', name: 'AnimeShowdown', url: SITIO },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Person',
          name: item.name,
          url: abs(item.path),
          image: abs(item.image),
          additionalType: 'https://schema.org/FictionalCharacter',
          ...(item.score != null
            ? {
                additionalProperty: {
                  '@type': 'PropertyValue',
                  name: item.scoreLabel || 'Ranking score',
                  value: item.score,
                },
              }
            : {}),
        },
      })),
    },
  }
}

/**
 * Schema {@code WebApplication} para juegos web individuales.
 *
 * @param {Object} opts
 * @param {string} opts.name nombre público del juego
 * @param {string} opts.path ruta canónica
 * @param {string} opts.description descripción clara de la mecánica
 * @param {string} [opts.alternateName] nombre alternativo o subtítulo
 * @param {string[]} [opts.featureList] mecánicas principales
 * @param {string[]} [opts.keywords] intenciones/búsquedas relacionadas
 */
export function gameWebApplicationSchema({
  name,
  path,
  description,
  alternateName,
  featureList = [],
  keywords = [],
}) {
  if (!name || !path) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    alternateName,
    url: abs(path),
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    inLanguage: 'es-ES',
    description,
    isAccessibleForFree: true,
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: SITIO,
    },
    ...(featureList.length ? { featureList } : {}),
    ...(keywords.length ? { keywords: keywords.join(', ') } : {}),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    potentialAction: {
      '@type': 'PlayAction',
      target: abs(path),
    },
  }
}

/**
 * Schema {@code BreadcrumbList} para mostrar la jerarquía en el rich snippet.
 * Acepta un array de pares {label, path}.
 */
export function breadcrumbsSchema(items) {
  if (!items || items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: abs(item.path),
    })),
  }
}

function mapEstadoEvento(estado) {
  // schema.org no tiene "in progress" ni "proximo" en castellano: eventos
  // activos/proximos quedan scheduled y los cerrados completed.
  switch (estado) {
    case 'FINISHED':
    case 'PASADO':
      return 'https://schema.org/EventCompleted'
    case 'IN_PROGRESS':
    case 'SCHEDULED':
    case 'ACTIVO':
    case 'PROXIMO':
    default:
      return 'https://schema.org/EventScheduled'
  }
}
