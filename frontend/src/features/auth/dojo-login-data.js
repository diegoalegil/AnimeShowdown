/* Datos y helpers puros de la entrada al dojo (/login). Módulo hermano:
   el .jsx solo exporta componentes (fast-refresh). */

/**
 * next seguro — mismo criterio que AuthSocialButtons: solo rutas
 * relativas propias (anti open-redirect).
 * @param {string|null} next
 * @returns {string}
 */
export function sanitizeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/**
 * Escena determinista por fecha: día UTC % scenes.length. Sin
 * Math.random — estable entre recargas del mismo día.
 * @param {Array<{slug: string, fandom: string}>} scenes
 * @param {number} [now=Date.now()] — inyectable para tests
 */
export function sceneOfDay(scenes, now = Date.now()) {
  if (!Array.isArray(scenes) || scenes.length === 0) return null
  return scenes[Math.floor(now / 86400000) % scenes.length]
}

/* Escena CONTEXTUAL de la puerta: si el visitante venía a un destino con arte
   propio (p. ej. el PvP en vivo, que exige cuenta), la entrada muestra ESA
   escena en vez de la del día — así la puerta "encaja" con lo que iba a hacer
   en vez de enseñar un anime al azar. Los slugs viven en el banco de marca
   (brand-assets-manifest, variantes -480/-768/-1280). */
export const ESCENAS_CONTEXTO = {
  '/duel-live': {
    slug: 'pvp-no-session',
    fandom: 'PvP en vivo',
    caption: 'Duelo 1v1 en directo — entra para combatir',
    contextual: true,
  },
}

/**
 * Escena de la entrada: contextual si `next` tiene arte propio; si no, la del día.
 * @param {string|null} next  destino ya saneado (sanitizeNext)
 * @param {Array<{slug: string, fandom: string}>} scenes
 * @param {number} [now=Date.now()]
 * @returns {({slug: string, fandom: string, caption?: string, contextual?: boolean}) | null}
 */
export function escenaDeEntrada(next, scenes, now = Date.now()) {
  return ESCENAS_CONTEXTO[next] ?? sceneOfDay(scenes, now)
}

/* Rotación curada del arte de la entrada: escenas 16:9 del banco de
   marca (todas verificadas contra brand-assets-manifest.json). */
export const DOJO_SCENES = [
  { slug: 'one-piece-scene-01', fandom: 'One Piece' },
  { slug: 'jujutsu-kaisen-scene-01', fandom: 'Jujutsu Kaisen' },
  { slug: 'attack-on-titan-scene-01', fandom: 'Attack on Titan' },
  { slug: 'demon-slayer-scene-01', fandom: 'Demon Slayer' },
  { slug: 'naruto-scene-01', fandom: 'Naruto' },
  { slug: 'chainsaw-man-scene-01', fandom: 'Chainsaw Man' },
  { slug: 'bleach-scene-01', fandom: 'Bleach' },
  { slug: 'my-hero-academia-scene-01', fandom: 'My Hero Academia' },
  { slug: 'hunter-x-hunter-scene-01', fandom: 'Hunter × Hunter' },
  { slug: 'dragon-ball-scene-01', fandom: 'Dragon Ball' },
  { slug: 'one-punch-man-scene-01', fandom: 'One-Punch Man' },
  { slug: 'solo-leveling-scene-01', fandom: 'Solo Leveling' },
  { slug: 'fullmetal-alchemist-scene-01', fandom: 'Fullmetal Alchemist' },
  { slug: 'death-note-scene-01', fandom: 'Death Note' },
  { slug: 'cowboy-bebop-scene-01', fandom: 'Cowboy Bebop' },
  { slug: 'neon-genesis-evangelion-scene-01', fandom: 'Evangelion' },
  { slug: 'haikyuu-scene-01', fandom: 'Haikyuu!!' },
  { slug: 'vinland-saga-scene-01', fandom: 'Vinland Saga' },
]
