import { VISUAL_ASSET_PATHS } from './visual-assets-manifest'

/**
 * Registro visual de AnimeShowdown.
 *
 * Las cards SSR siguen existiendo para personaje/coleccionable, pero las
 * portadas editoriales de animes, torneos, eventos y juegos viven aqui.
 * Mientras no exista una imagen final en /assets/*, el frontend usa una
 * escena cinematografica de marca como fallback y aplica kanji, glow y
 * overlays propios para que no vuelva a caer en collages de cartas.
 */

const STAGE = {
  home: '/img/stage/home-hero.webp',
  pulse: '/img/stage/home-pulse.webp',
  games: '/img/stage/games-stage.webp',
  shadow: '/img/stage/games-stage.webp',
  reveal: '/img/stage/anime-reveal.webp',
  anigrid: '/img/stage/games-stage.webp',
  impostor: '/img/stage/impostor.webp',
  duel: '/img/stage/elo-duel.webp',
  ranking: '/img/stage/ranking.webp',
  animes: '/img/stage/animes.webp',
  torneos: '/img/stage/torneos.webp',
  eventos: '/img/stage/eventos.webp',
  omikuji: '/img/stage/omikuji.webp',
  error: '/img/stage/error-rain.webp',
}

const PALETTES = [
  { accent: '#9f1d2c', accentRgb: '159 29 44', glow: '#c5a15a', glowRgb: '197 161 90' },
  { accent: '#7f1d1d', accentRgb: '127 29 29', glow: '#24c6dc', glowRgb: '36 198 220' },
  { accent: '#8a5a16', accentRgb: '138 90 22', glow: '#c5a15a', glowRgb: '197 161 90' },
  { accent: '#1f6b83', accentRgb: '31 107 131', glow: '#24c6dc', glowRgb: '36 198 220' },
  { accent: '#4b327f', accentRgb: '75 50 127', glow: '#c5a15a', glowRgb: '197 161 90' },
]

const EXTENSIONS = ['webp', 'avif', 'png', 'jpg', 'jpeg', 'svg']

function resolveAsset(path) {
  if (!path) return null
  if (VISUAL_ASSET_PATHS.has(path)) return path

  const base = path.replace(/\.(webp|avif|png|jpe?g|svg)$/i, '')
  for (const ext of EXTENSIONS) {
    const candidate = `${base}.${ext}`
    if (VISUAL_ASSET_PATHS.has(candidate)) return candidate
  }
  return null
}

function palette(seed = '') {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTES[hash % PALETTES.length]
}

function makeVisual({
  slug,
  title,
  type,
  kanji,
  fallbackImage,
  expectedPath,
  image = null,
  description = '',
  mood = '',
  objectPosition = 'center',
  paletteSeed = slug,
  accent,
  accentRgb,
  glow,
  glowRgb,
}) {
  const p = palette(paletteSeed)
  const resolvedImage = image ?? resolveAsset(expectedPath)
  return {
    slug,
    title,
    type,
    kanji,
    image: resolvedImage,
    fallbackImage,
    expectedPath,
    description,
    mood,
    objectPosition,
    accent: accent ?? p.accent,
    accentRgb: accentRgb ?? p.accentRgb,
    glow: glow ?? p.glow,
    glowRgb: glowRgb ?? p.glowRgb,
  }
}

export const ANIME_VISUALS = {
  naruto: makeVisual({
    slug: 'naruto',
    title: 'Naruto',
    type: 'anime',
    kanji: '忍',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/naruto.webp',
    mood: 'shinobi nocturno, chakra, aldea y pergaminos',
    objectPosition: 'center',
    accent: '#8a5a16',
    accentRgb: '138 90 22',
  }),
  'one-piece': makeVisual({
    slug: 'one-piece',
    title: 'One Piece',
    type: 'anime',
    kanji: '海',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/one-piece.webp',
    mood: 'aventura marítima, tripulación y dorado cálido',
    objectPosition: 'center top',
    accent: '#c5a15a',
    accentRgb: '197 161 90',
  }),
  'my-hero-academia': makeVisual({
    slug: 'my-hero-academia',
    title: 'My Hero Academia',
    type: 'anime',
    kanji: '英',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/my-hero-academia.webp',
    mood: 'ciudad de héroes, energía verde y villanía roja',
    objectPosition: 'center',
    accent: '#1f6b83',
    accentRgb: '31 107 131',
    glow: '#9f1d2c',
    glowRgb: '159 29 44',
  }),
  'demon-slayer': makeVisual({
    slug: 'demon-slayer',
    title: 'Demon Slayer',
    type: 'anime',
    kanji: '滅',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/demon-slayer.webp',
    mood: 'bosque nocturno, luna, fuego y niebla',
    objectPosition: 'center',
    accent: '#7f1d1d',
    accentRgb: '127 29 29',
  }),
  'jujutsu-kaisen': makeVisual({
    slug: 'jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    type: 'anime',
    kanji: '呪',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/jujutsu-kaisen.webp',
    mood: 'maldiciones, ritual urbano y energía púrpura',
    objectPosition: 'center',
    accent: '#4b327f',
    accentRgb: '75 50 127',
    glow: '#24c6dc',
    glowRgb: '36 198 220',
  }),
  'attack-on-titan': makeVisual({
    slug: 'attack-on-titan',
    title: 'Attack on Titan',
    type: 'anime',
    kanji: '壁',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/attack-on-titan.webp',
    mood: 'murallas, humo, guerra y tensión dramática',
    objectPosition: 'center',
    accent: '#8a5a16',
    accentRgb: '138 90 22',
    glow: '#9f1d2c',
    glowRgb: '159 29 44',
  }),
  'death-note': makeVisual({
    slug: 'death-note',
    title: 'Death Note',
    type: 'anime',
    kanji: '裁',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/death-note.webp',
    mood: 'juicio nocturno, libreta y luz dorada fría',
    objectPosition: 'center',
    accent: '#111827',
    accentRgb: '17 24 39',
    glow: '#c5a15a',
    glowRgb: '197 161 90',
  }),
  'fullmetal-alchemist': makeVisual({
    slug: 'fullmetal-alchemist',
    title: 'Fullmetal Alchemist',
    type: 'anime',
    kanji: '錬',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/anime-banners/fullmetal-alchemist.webp',
    mood: 'círculos alquímicos, metal y chispas doradas',
    objectPosition: 'center',
    accent: '#8a5a16',
    accentRgb: '138 90 22',
  }),
}

export const TOURNAMENT_VISUALS = {
  'mha-heroes-vs-villains': makeVisual({
    slug: 'mha-heroes-vs-villains',
    title: 'MHA: Heroes vs Villanos',
    type: 'tournament',
    kanji: '対',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/tournament-banners/mha-heroes-vs-villains.webp',
    mood: 'dos bandos enfrentados, verde heroico contra rojo oscuro',
    objectPosition: 'center',
    accent: '#1f6b83',
    accentRgb: '31 107 131',
    glow: '#9f1d2c',
    glowRgb: '159 29 44',
  }),
  'one-piece-strawhats': makeVisual({
    slug: 'one-piece-strawhats',
    title: 'One Piece — Sombrero de Paja',
    type: 'tournament',
    kanji: '海',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/tournament-banners/one-piece-strawhats.webp',
    mood: 'campaña marítima, bandera y tripulación',
    objectPosition: 'center top',
    accent: '#c5a15a',
    accentRgb: '197 161 90',
  }),
  'slayers-vs-sorcerers': makeVisual({
    slug: 'slayers-vs-sorcerers',
    title: 'Slayers vs Sorcerers',
    type: 'tournament',
    kanji: '術',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/tournament-banners/slayers-vs-sorcerers.webp',
    mood: 'espadas, magia, fuego y energía arcana',
    objectPosition: 'center',
    accent: '#7f1d1d',
    accentRgb: '127 29 29',
    glow: '#24c6dc',
    glowRgb: '36 198 220',
  }),
  'demon-slayer-internal': makeVisual({
    slug: 'demon-slayer-internal',
    title: 'Demon Slayer Internal',
    type: 'tournament',
    kanji: '柱',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/tournament-banners/demon-slayer-internal.webp',
    mood: 'noche japonesa, respiraciones y acero',
    objectPosition: 'center',
    accent: '#7f1d1d',
    accentRgb: '127 29 29',
  }),
  'pillars-of-the-corps': makeVisual({
    slug: 'pillars-of-the-corps',
    title: 'Pilares del Cuerpo',
    type: 'tournament',
    kanji: '柱',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/tournament-banners/pillars-of-the-corps.webp',
    mood: 'elite ceremonial, oro apagado y rojo profundo',
    objectPosition: 'center',
    accent: '#c5a15a',
    accentRgb: '197 161 90',
    glow: '#9f1d2c',
    glowRgb: '159 29 44',
  }),
  'shonen-showdown': makeVisual({
    slug: 'shonen-showdown',
    title: 'Shōnen Showdown',
    type: 'tournament',
    kanji: '王',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/tournament-banners/shonen-showdown.webp',
    mood: 'arena shonen caótica, energía y fragmentos',
    objectPosition: 'center',
  }),
}

export const EVENT_VISUALS = {
  'copa-villanos': makeVisual({
    slug: 'copa-villanos',
    title: 'Copa Villanos',
    type: 'event',
    kanji: '悪',
    fallbackImage: STAGE.eventos,
    expectedPath: '/assets/event-covers/copa-villanos.webp',
    mood: 'villanos, humo, púrpura y amenaza roja',
    objectPosition: 'center',
    accent: '#7f1d1d',
    accentRgb: '127 29 29',
    glow: '#4b327f',
    glowRgb: '75 50 127',
  }),
  'semana-one-piece': makeVisual({
    slug: 'semana-one-piece',
    title: 'Semana de One Piece',
    type: 'event',
    kanji: '航',
    fallbackImage: STAGE.eventos,
    expectedPath: '/assets/event-covers/semana-one-piece.webp',
    mood: 'campaña de tripulación, mar nocturno y oro',
    objectPosition: 'center top',
    accent: '#c5a15a',
    accentRgb: '197 161 90',
  }),
  'arco-husbandos': makeVisual({
    slug: 'arco-husbandos',
    title: 'Arco Husbandos',
    type: 'event',
    kanji: '剣',
    fallbackImage: STAGE.eventos,
    expectedPath: '/assets/event-covers/arco-husbandos.webp',
    mood: 'presentación elegante, violeta, acero y premium',
    objectPosition: 'center',
    accent: '#4b327f',
    accentRgb: '75 50 127',
    glow: '#c5a15a',
    glowRgb: '197 161 90',
  }),
  'top-waifus': makeVisual({
    slug: 'top-waifus',
    title: 'Top Waifus',
    type: 'event',
    kanji: '華',
    fallbackImage: STAGE.eventos,
    expectedPath: '/assets/event-covers/top-waifus.webp',
    mood: 'flores oscuras, brillo suave y dorado controlado',
    objectPosition: 'center',
    accent: '#9f1d2c',
    accentRgb: '159 29 44',
    glow: '#c5a15a',
    glowRgb: '197 161 90',
  }),
}

export const GAME_VISUALS = {
  '/games/shadow-guess': makeVisual({
    slug: 'shadow-guess',
    title: 'Shadow Guess',
    type: 'game',
    kanji: '影',
    fallbackImage: STAGE.shadow,
    expectedPath: '/assets/game-covers/shadow-guess.webp',
    mood: 'silueta, luna carmesí, kanji y misterio',
    objectPosition: 'right center',
    accent: '#9f1d2c',
    accentRgb: '159 29 44',
  }),
  '/games/anime-reveal': makeVisual({
    slug: 'anime-reveal',
    title: 'Anime Reveal',
    type: 'game',
    kanji: '謎',
    fallbackImage: STAGE.reveal,
    expectedPath: '/assets/game-covers/anime-reveal.webp',
    mood: 'personaje borroso, distorsión y revelación',
    objectPosition: 'center',
    accent: '#8a5a16',
    accentRgb: '138 90 22',
  }),
  '/games/anigrid': makeVisual({
    slug: 'anigrid',
    title: 'AniGrid',
    type: 'game',
    kanji: '格',
    fallbackImage: STAGE.anigrid,
    expectedPath: '/assets/game-covers/anigrid.webp',
    mood: 'cuadrícula lógica, pistas y teal tecnológico',
    objectPosition: 'center',
    accent: '#1f6b83',
    accentRgb: '31 107 131',
    glow: '#24c6dc',
    glowRgb: '36 198 220',
  }),
  '/games/impostor-trial': makeVisual({
    slug: 'impostor-trial',
    title: 'Impostor Trial',
    type: 'game',
    kanji: '裏',
    fallbackImage: STAGE.impostor,
    expectedPath: '/assets/game-covers/impostor-trial.webp',
    mood: 'juicio oscuro, cuatro siluetas y una aura distinta',
    objectPosition: 'center',
    accent: '#4b327f',
    accentRgb: '75 50 127',
  }),
  '/games/elo-duel': makeVisual({
    slug: 'elo-duel',
    title: 'ELO Duel',
    type: 'game',
    kanji: '戦',
    fallbackImage: STAGE.duel,
    expectedPath: '/assets/game-covers/elo-duel.webp',
    mood: 'VS, arena oscura y energía dividida',
    objectPosition: 'center',
    accent: '#9f1d2c',
    accentRgb: '159 29 44',
    glow: '#24c6dc',
    glowRgb: '36 198 220',
  }),
  '/omikuji': makeVisual({
    slug: 'omikuji',
    title: 'Omikuji diario',
    type: 'game',
    kanji: '吉',
    fallbackImage: STAGE.omikuji,
    expectedPath: '/assets/game-covers/omikuji.webp',
    mood: 'santuario nocturno, torii, papel y fortuna',
    objectPosition: 'center',
    accent: '#c5a15a',
    accentRgb: '197 161 90',
  }),
}

export const BRAND_VISUALS = {
  homeHero: makeVisual({
    slug: 'home-hero',
    title: 'AnimeShowdown',
    type: 'brand',
    kanji: '決',
    fallbackImage: STAGE.home,
    expectedPath: '/assets/brand/backgrounds/home-hero.webp',
    mood: 'arena nocturna, logo de torneo, energía y ciudad',
    objectPosition: 'center',
  }),
  pulse: makeVisual({
    slug: 'home-pulse',
    title: 'Ahora mismo',
    type: 'brand',
    kanji: '今',
    fallbackImage: STAGE.pulse,
    expectedPath: '/assets/brand/backgrounds/home-pulse.webp',
    mood: 'dashboard vivo de combates y actividad',
    objectPosition: 'center',
  }),
  ranking: makeVisual({
    slug: 'ranking-hero',
    title: 'Salón de la fama',
    type: 'brand',
    kanji: '冠',
    fallbackImage: STAGE.ranking,
    expectedPath: '/assets/brand/backgrounds/ranking-hero.webp',
    mood: 'salón de la fama, trofeo y luz dorada',
    objectPosition: 'center',
    accent: '#c5a15a',
    accentRgb: '197 161 90',
    glow: '#9f1d2c',
    glowRgb: '159 29 44',
  }),
  animes: makeVisual({
    slug: 'anime-catalog',
    title: 'Universos anime',
    type: 'brand',
    kanji: '界',
    fallbackImage: STAGE.animes,
    expectedPath: '/assets/brand/backgrounds/anime-catalog.webp',
    mood: 'archivo premium de universos anime',
    objectPosition: 'center',
  }),
  torneos: makeVisual({
    slug: 'tournament-catalog',
    title: 'Torneos',
    type: 'brand',
    kanji: '戦',
    fallbackImage: STAGE.torneos,
    expectedPath: '/assets/brand/backgrounds/tournament-catalog.webp',
    mood: 'arena de brackets, energía VS y humo',
    objectPosition: 'center',
    accent: '#1f6b83',
    accentRgb: '31 107 131',
    glow: '#9f1d2c',
    glowRgb: '159 29 44',
  }),
  eventos: makeVisual({
    slug: 'events-hero',
    title: 'Eventos',
    type: 'brand',
    kanji: '祭',
    fallbackImage: STAGE.eventos,
    expectedPath: '/assets/brand/backgrounds/events-hero.webp',
    mood: 'campañas temporales, festival oscuro y temporada',
    objectPosition: 'center',
    accent: '#4b327f',
    accentRgb: '75 50 127',
    glow: '#c5a15a',
    glowRgb: '197 161 90',
  }),
  games: makeVisual({
    slug: 'games-hub',
    title: 'Retos diarios',
    type: 'brand',
    kanji: '遊',
    fallbackImage: STAGE.games,
    expectedPath: '/assets/brand/backgrounds/games-hub.webp',
    mood: 'ritual diario, retos nocturnos y minijuegos',
    objectPosition: 'center',
  }),
  error: makeVisual({
    slug: 'error-rain',
    title: 'Error scene',
    type: 'error',
    kanji: '雨',
    // Audit 2026-05-20: rainy-rooftop.webp aun no esta generado (pendiente
    // en docs/visual-assets-pendientes.md). Mientras no exista, apuntamos
    // expectedPath a not-found-lost-shinobi.webp (si esta poblado y es
    // tematicamente compatible: shinobi melancolico bajo neon). El
    // fallbackImage sigue siendo STAGE.error como ultima red.
    fallbackImage: STAGE.error,
    expectedPath: '/assets/error-scenes/not-found-lost-shinobi.webp',
    mood: 'shinobi perdido bajo neon nocturno, ambiente melancolico',
    objectPosition: '50% center',
  }),
  empty: makeVisual({
    slug: 'empty-state',
    title: 'Empty state',
    type: 'empty',
    kanji: '待',
    // Audit 2026-05-20: quiet-arena.webp pendiente, mientras tanto
    // usamos empty-search-night-city.webp como visual provisional —
    // mantiene la idea de "no hay nada que mostrar" en composicion
    // urbana nocturna en vez del stage generico vacio.
    fallbackImage: STAGE.error,
    expectedPath: '/assets/empty-states/empty-search-night-city.webp',
    mood: 'ciudad nocturna en silencio, sensacion de espera',
    objectPosition: 'center',
  }),
}

export function getAnimeVisual(slug, anime = slug) {
  if (ANIME_VISUALS[slug]) return ANIME_VISUALS[slug]
  return makeVisual({
    slug,
    title: anime,
    type: 'anime',
    kanji: '界',
    fallbackImage: STAGE.animes,
    expectedPath: `/assets/anime-banners/${slug}.webp`,
    paletteSeed: slug,
  })
}

export function getTournamentVisual(slug, title = slug) {
  if (TOURNAMENT_VISUALS[slug]) return TOURNAMENT_VISUALS[slug]
  return makeVisual({
    slug,
    title,
    type: 'tournament',
    kanji: '戦',
    fallbackImage: STAGE.torneos,
    expectedPath: `/assets/tournament-banners/${slug}.webp`,
    paletteSeed: slug,
  })
}

export function getEventVisual(slug, title = slug) {
  if (EVENT_VISUALS[slug]) return EVENT_VISUALS[slug]
  return makeVisual({
    slug,
    title,
    type: 'event',
    kanji: '祭',
    fallbackImage: STAGE.eventos,
    expectedPath: `/assets/event-covers/${slug}.webp`,
    paletteSeed: slug,
  })
}

export function getGameVisual(to, title = to) {
  if (GAME_VISUALS[to]) return GAME_VISUALS[to]
  return makeVisual({
    slug: String(to).replace(/^\//, '').replaceAll('/', '-'),
    title,
    type: 'game',
    kanji: '遊',
    fallbackImage: STAGE.games,
    expectedPath: `/assets/game-covers/${String(to).replace(/^\//, '').replaceAll('/', '-')}.webp`,
    paletteSeed: to,
  })
}

export const VISUAL_ASSET_ROOTS = [
  '/assets/brand/backgrounds/',
  '/assets/anime-banners/',
  '/assets/tournament-banners/',
  '/assets/event-covers/',
  '/assets/game-covers/',
  '/assets/error-scenes/',
  '/assets/empty-states/',
  '/assets/fallbacks/',
  '/assets/particles/',
  '/assets/overlays/',
  '/assets/brand/decorations/',
  '/assets/brand/kanji/',
]
