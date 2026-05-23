/**
 * Categorías otaku (Nota de producto 2026-05-18 — visión "estadio otaku").
 *
 * Enfoque mixto:
 *   1. Overrides manuales curados (este archivo). Si un personaje aparece
 *      aquí, sus categorías son las explícitas, sin heurística.
 *   2. Si NO aparece, queda sin categoría — mejor sin tag que mal tag.
 *
 * Categorías soportadas:
 *   - hero        Héroes que luchan abiertamente por el bien.
 *   - villain     Villanos (de cualquier género).
 *   - waifu       Personajes femeninos icónicos de la fandom.
 *   - husbando    Personajes masculinos icónicos de la fandom.
 *   - protagonist Protagonista de su serie (suelen ser también hero/antihero).
 *   - rival       Rival del protagonista / segundo en discordia.
 *   - mentor      Maestros, sensei, figuras paternas.
 *   - antihero    Héroe ambiguo, métodos discutibles (Lelouch, Light, Eren tardío…).
 *   - shounen     Personajes de obras shounen claramente reconocibles.
 *   - isekai      Personajes de obras isekai.
 *   - mecha       Personajes asociados a obras de mechas.
 *   - sports-anime Personajes de anime deportivo.
 *   - power-scaling Personajes frecuentes en debates de poder.
 *
 * Un personaje puede llevar varios tags. Ejemplo: Luffy → [hero,
 * protagonist, husbando]; Makima → [villain, waifu].
 *
 * Si añades un personaje al catálogo y crees que encaja en alguna,
 * añade su slug aquí. No usar heurística automática por nombre — el
 * usuario fue explícito: "si la heurística no está segura, dejar el
 * personaje sin categoría antes que clasificar mal".
 */

const TAGS_OVERRIDE = {
  // ====== One Piece ======
  luffy: ['hero', 'protagonist', 'husbando', 'shounen', 'power-scaling'],
  zoro: ['rival', 'hero', 'husbando', 'shounen'],
  sanji: ['hero', 'husbando', 'shounen'],
  nami: ['hero', 'waifu'],
  nico_robin: ['hero', 'waifu'],
  edward_newgate: ['mentor'],

  // ====== Naruto ======
  naruto: ['hero', 'protagonist', 'shounen', 'power-scaling'],
  sasuke: ['rival', 'antihero', 'husbando', 'shounen'],
  itachi: ['antihero', 'husbando', 'shounen'],
  kakashi: ['mentor', 'husbando'],
  jiraya: ['mentor'],
  tsunade: ['mentor'],
  madara: ['villain', 'power-scaling'],
  obito_uchiha: ['villain', 'antihero'],
  pain: ['villain'],
  nagato: ['villain', 'antihero'],
  orochimaru: ['villain'],
  hinata: ['dandere', 'waifu'],
  sakura_haruno: ['waifu'],
  gaara: ['rival', 'antihero'],

  // ====== Dragon Ball ======
  goku: ['hero', 'protagonist', 'shounen', 'power-scaling'],
  vegeta: ['rival', 'antihero', 'husbando', 'shounen', 'power-scaling'],
  piccolo: ['mentor'],
  frieza: ['villain', 'shounen', 'power-scaling'],
  cell: ['villain', 'shounen'],

  // ====== My Hero Academia ======
  deku: ['hero', 'protagonist', 'shounen'],
  allmight: ['mentor', 'hero', 'shounen'],
  bakugo: ['rival', 'shounen'],
  shoto_todoroki: ['rival', 'husbando'],
  tomura_shigaraki: ['villain'],
  dabi: ['villain'],
  toga: ['villain', 'waifu'],
  hawks: ['hero', 'husbando'],

  // ====== Bleach ======
  ichigo_kurosaki: ['hero', 'protagonist', 'shounen'],
  sosuke_aizen: ['villain'],

  // ====== Demon Slayer ======
  nezuko: ['waifu', 'shounen'],
  shinobu: ['waifu'],
  rengoku: ['mentor', 'hero', 'husbando', 'shounen'],
  inosuke: ['rival', 'shounen'],
  zenitsu_agatsuma: ['hero', 'shounen'],
  muzan: ['villain'],
  akaza: ['villain'],
  kokushibo: ['villain'],

  // ====== Jujutsu Kaisen ======
  itadori: ['hero', 'protagonist', 'shounen'],
  satoru_gojo: ['mentor', 'husbando', 'shounen', 'power-scaling'],
  kento_nanami: ['mentor', 'husbando'],
  megumi_fushiguro: ['hero', 'husbando', 'shounen'],
  nobara_kugisaki: ['hero', 'waifu', 'shounen'],
  sukuna: ['villain', 'shounen', 'power-scaling'],
  toji_fushiguro: ['villain', 'antihero', 'husbando'],
  mahito: ['villain'],

  // ====== Attack on Titan ======
  eren_yeager: ['antihero', 'protagonist'],
  mikasa_ackerman: ['kuudere', 'hero', 'waifu'],
  levi_ackerman: ['hero', 'husbando'],

  // ====== Death Note ======
  light_yagami: ['villain', 'antihero', 'protagonist', 'husbando'],

  // ====== Code Geass ======
  lelouch_lamperouge: ['antihero', 'protagonist', 'husbando', 'mecha'],

  // ====== Re:Zero ======
  rem: ['waifu', 'isekai'],
  rem_and_ram: ['waifu', 'isekai'],
  emilia: ['waifu', 'isekai'],
  natsuki_subaru: ['protagonist', 'isekai'],

  // ====== Fate ======
  saber: ['waifu', 'hero'],

  // ====== Fullmetal Alchemist ======
  edward_elric: ['hero', 'protagonist'],
  alphonse_elric: ['hero'],
  roy_mustang: ['mentor', 'husbando'],
  riza_hawkeye: ['waifu'],
  maes_hughes: ['mentor'],
  olivier_armstrong: ['waifu'],
  van_hohenheim: ['mentor'],
  scar: ['antihero'],
  lust: ['villain', 'waifu'],
  pride: ['villain'],
  wrath_king_bradley: ['villain'],

  // ====== Frieren ======
  flamme: ['mentor'],

  // ====== Fumetsu no Anata e ======
  fushi: ['protagonist'],

  // ====== Otros icónicos por nombre ======
  asuka: ['tsundere', 'waifu', 'mecha'],
  taiga_aisaka: ['tsundere', 'waifu'],
  gasai_yuno: ['yandere', 'villain', 'waifu'],
  rei: ['kuudere', 'waifu', 'mecha'],
  mai_sakurajima: ['waifu'],
  asuna: ['waifu'],
  zero_two: ['waifu'],
  makima: ['villain', 'waifu'],
  megumin: ['waifu', 'isekai'],
  aqua: ['waifu', 'isekai'],
  kazuma_satou: ['protagonist', 'isekai'],
  rudeus_greyrat: ['protagonist', 'isekai'],
  ainz_ooal_gown: ['villain', 'isekai'],
  shinji_ikari: ['protagonist', 'mecha'],
  koji_kabuto: ['hero', 'mecha'],
  mazinger_z: ['mecha', 'power-scaling'],
  simon: ['protagonist', 'mecha'],
  kamina: ['mentor', 'mecha'],
  shoyo_hinata: ['protagonist', 'sports-anime'],
  tobio_kageyama: ['rival', 'sports-anime'],
  yoichi_isagi: ['protagonist', 'sports-anime'],
  rin_itoshi: ['rival', 'sports-anime'],
  mamoru_endou: ['protagonist', 'sports-anime'],
  shuuya_gouenji: ['rival', 'sports-anime'],
  saitama: ['hero', 'protagonist', 'power-scaling'],
}

/**
 * Catálogo de categorías con su label visible y orden de presentación
 * en /ranking. El orden refleja la importancia narrativa para fandom
 * otaku — héroes y villanos primero, después arquetipos.
 */
export const CATEGORIAS = [
  { id: 'hero', label: 'Héroes', emoji: '🦸', tono: 'sky' },
  { id: 'villain', label: 'Villanos', emoji: '😈', tono: 'rose' },
  { id: 'waifu', label: 'Waifus', emoji: '💖', tono: 'pink' },
  { id: 'husbando', label: 'Husbandos', emoji: '🗡️', tono: 'violet' },
  { id: 'protagonist', label: 'Protagonistas', emoji: '⭐', tono: 'amber' },
  { id: 'rival', label: 'Rivales', emoji: '⚔️', tono: 'orange' },
  { id: 'mentor', label: 'Mentores', emoji: '🧙', tono: 'emerald' },
  { id: 'antihero', label: 'Antihéroes', emoji: '🌑', tono: 'purple' },
  { id: 'shounen', label: 'Shounen', emoji: '🔥', tono: 'orange' },
  { id: 'isekai', label: 'Isekai', emoji: '🌀', tono: 'violet' },
  { id: 'mecha', label: 'Mecha', emoji: '🤖', tono: 'sky' },
  { id: 'sports-anime', label: 'Sports anime', emoji: '🏐', tono: 'emerald' },
  { id: 'power-scaling', label: 'Power scaling', emoji: '📈', tono: 'amber' },
  { id: 'tsundere', label: 'Tsundere', emoji: '🌶️', tono: 'rose' },
  { id: 'yandere', label: 'Yandere', emoji: '🩸', tono: 'purple' },
  { id: 'kuudere', label: 'Kuudere', emoji: '❄️', tono: 'sky' },
  { id: 'dandere', label: 'Dandere', emoji: '🌙', tono: 'violet' },
]

export const RASGOS_OTAKU = CATEGORIAS

/**
 * Devuelve las categorías de un personaje. Vacío si no está tagueado
 * (el caller decide cómo mostrar — típico: ocultar el chip).
 */
export function getCategoriasPersonaje(slug) {
  return TAGS_OVERRIDE[slug] ?? []
}

export function hasCategoriaPersonaje(categoriaId) {
  return Object.values(TAGS_OVERRIDE).some((tags) => tags.includes(categoriaId))
}

/**
 * Devuelve los personajes que pertenecen a una categoría. El caller
 * pasa el catálogo para no acoplar este archivo a una fuente concreta.
 */
export function getPersonajesPorCategoria(categoriaId, personajes) {
  return personajes.filter((p) =>
    getCategoriasPersonaje(p.slug).includes(categoriaId),
  )
}

/**
 * Mínimo de personajes tagueados para mostrar la categoría como sección
 * propia en /ranking. Si tiene menos, la sección se omite (evita
 * "Top Mentores: 1 personaje", que se ve raro).
 */
export const MIN_PARA_SECCION = 3
