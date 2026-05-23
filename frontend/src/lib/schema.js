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
 *       todavía soportado de forma irregular por Google). {@code characterAttribute}
 *       lleva ELO base y votos registrados para que el rich snippet muestre datos.</li>
 *   <li>Torneo: {@code SportsEvent} con {@code competitor[]} = personajes
 *       del bracket. El status mapea a {@code eventStatus} de schema.org.</li>
 *   <li>Anime: {@code TVSeries} con {@code character[]} referenciando
 *       los personajes del catálogo de ese anime.</li>
 * </ul>
 */

const SITIO = 'https://animeshowdown.dev'

function abs(path) {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
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
 * Schema {@code Person} para un personaje individual.
 *
 * @param personaje objeto del catálogo cliente-side con {slug, nombre, anime, descripcion, imagen}
 * @param stats opcional con {elo, wins, losses}
 */
export function personajeSchema(personaje, stats) {
  if (!personaje) return null
  const url = abs(`/personajes/${personaje.slug}`)
  const imagen = abs(personaje.imagen ?? personaje.imagenUrl)
  const animeSlug = slugifySchemaName(personaje.anime)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: personaje.nombre,
    url,
    image: imagen,
    description: personaje.descripcion,
    additionalType: 'https://schema.org/FictionalCharacter',
    affiliation: {
      '@type': 'CreativeWorkSeries',
      name: personaje.anime,
      url: animeSlug ? abs(`/animes/${animeSlug}`) : undefined,
    },
  }
  if (personaje.sameAs || personaje.wikidataUrl || personaje.malUrl) {
    schema.sameAs = [personaje.sameAs, personaje.wikidataUrl, personaje.malUrl]
      .flat()
      .filter(Boolean)
  }
  if (stats && Number.isFinite(stats.elo)) {
    schema.additionalProperty = [
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
    ]
  }
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
  const personajes = Array.isArray(animeData.personajes)
    ? animeData.personajes
    : []
  const character = personajes.slice(0, 80).map((p) => ({
    '@type': 'Person',
    '@id': abs(`/personajes/${p.slug}`),
    name: p.nombre,
    url: abs(`/personajes/${p.slug}`),
    image: abs(p.imagen ?? p.imagenUrl),
  }))
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWorkSeries',
    additionalType: 'https://schema.org/TVSeries',
    name: animeData.anime,
    url: abs(`/animes/${slug}`),
    image: abs(`/assets/anime-banners/${slug}.webp`),
    inLanguage: 'ja',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: SITIO,
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
  if (Number.isFinite(animeData.numberOfEpisodes)) {
    schema.numberOfEpisodes = animeData.numberOfEpisodes
  }
  if (animeData.topElo) {
    schema.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Top ELO base',
      value: animeData.topElo.elo,
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
 */
export function torneoSchema(torneo, competidores = []) {
  if (!torneo) return null
  const url = abs(`/torneos/${torneo.slug}`)
  const eventStatus = mapEstadoEvento(torneo.estado)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: torneo.nombre,
    url,
    description:
      torneo.descripcion ||
      `Bracket de ${competidores.length} personajes de anime cara a cara.`,
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url,
    },
    organizer: {
      '@type': 'Organization',
      name: 'AnimeShowdown',
      url: SITIO,
    },
  }
  if (torneo.fechaInicio) schema.startDate = torneo.fechaInicio
  if (torneo.fechaFinalizacion) schema.endDate = torneo.fechaFinalizacion
  if (competidores.length > 0) {
    schema.competitor = competidores.map((c) => ({
      '@type': 'Person',
      name: c.nombre,
      url: abs(`/personajes/${c.slug}`),
      // El catálogo cliente usa {imagen}; el DTO backend usa {imagenUrl}.
      // Aceptamos ambos para que esta factory sirva en cualquiera de los
      // dos contextos sin tener que mapear antes.
      image: abs(c.imagen ?? c.imagenUrl),
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
  // schema.org no tiene "in progress" — usamos EventScheduled para los
  // 3 estados (SCHEDULED, IN_PROGRESS, FINISHED). Rich snippets aún
  // mostrarán las fechas correctamente porque ahí va startDate / endDate.
  switch (estado) {
    case 'IN_PROGRESS':
    case 'FINISHED':
    case 'SCHEDULED':
    default:
      return 'https://schema.org/EventScheduled'
  }
}
