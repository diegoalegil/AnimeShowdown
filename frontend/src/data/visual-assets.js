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
  paletteSeed = slug,
  accent,
  accentRgb,
  glow,
  glowRgb,
}) {
  const p = palette(paletteSeed)
  const resolvedImage = image ?? (
    expectedPath && VISUAL_ASSET_PATHS.has(expectedPath) ? expectedPath : null
  )
  return {
    slug,
    title,
    type,
    kanji,
    image: resolvedImage,
    fallbackImage,
    expectedPath,
    description,
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
  }),
  pulse: makeVisual({
    slug: 'home-pulse',
    title: 'Ahora mismo',
    type: 'brand',
    kanji: '今',
    fallbackImage: STAGE.pulse,
    expectedPath: '/assets/brand/backgrounds/home-pulse.webp',
  }),
  error: makeVisual({
    slug: 'error-rain',
    title: 'Error scene',
    type: 'error',
    kanji: '雨',
    fallbackImage: STAGE.error,
    expectedPath: '/assets/error-scenes/rainy-rooftop.webp',
  }),
  empty: makeVisual({
    slug: 'empty-state',
    title: 'Empty state',
    type: 'empty',
    kanji: '待',
    fallbackImage: STAGE.error,
    expectedPath: '/assets/empty-states/quiet-arena.webp',
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
  '/assets/particles/',
  '/assets/overlays/',
]
