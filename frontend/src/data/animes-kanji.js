/**
 * Kanji de universo — UN kanji con significado real por anime, para las
 * esquinas selladas del podio (y cualquier superficie que quiera firmar
 * un universo). Curado a mano: solo entradas defendibles (del título
 * original o del concepto central de la obra); un anime sin entrada
 * simplemente no pinta kanji (jamás japonés de relleno).
 *
 * Claves = nombre visible del catálogo (`personaje.anime`).
 *
 * Cada entrada es `{ glifo, significado }`: el `significado` es la lectura
 * editorial real del glifo en el contexto de la obra (texto en español, sin
 * japonés de relleno). Se promueve de comentario a dato para poder mostrarlo
 * (tooltip del lomo, caption de la guarda/dossier) — es el micro-momento de
 * descubrimiento del rediseño. Si una entrada no tiene significado defendible,
 * basta con omitir el campo (los consumidores degradan sin caption).
 */
export const ANIMES_KANJI_ENTRIES = {
  'One Piece': { glifo: '海', significado: 'el mar — la Grand Line entera' },
  'Naruto': { glifo: '忍', significado: 'shinobi, el camino ninja' },
  'Dragon Ball': { glifo: '龍', significado: 'el dragón Shenron' },
  'Bleach': { glifo: '死', significado: 'muerte — shinigami (死神)' },
  'Jujutsu Kaisen': { glifo: '呪', significado: 'la maldición del título (呪術廻戦)' },
  'Demon Slayer': { glifo: '鬼', significado: 'oni, los demonios de Kimetsu no Yaiba (鬼滅の刃)' },
  'Attack on Titan': { glifo: '巨', significado: 'lo gigante — los titanes (進撃の巨人)' },
  'Hunter x Hunter': { glifo: '狩', significado: 'la caza' },
  'My Hero Academia': { glifo: '英', significado: 'héroe (英雄)' },
  'Death Note': { glifo: '裁', significado: 'el juicio de Kira' },
  'Fullmetal Alchemist': { glifo: '錬', significado: 'alquimia (錬金術)' },
  'One Punch Man': { glifo: '拳', significado: 'el puño' },
  'Tokyo Ghoul': { glifo: '喰', significado: 'devorar — del título original (東京喰種)' },
  'Sword Art Online': { glifo: '剣', significado: 'la espada' },
  'Neon Genesis Evangelion': { glifo: '使', significado: 'los ángeles, shito (使徒)' },
  'Gintama': { glifo: '銀', significado: 'la plata del título (銀魂)' },
}

/**
 * Mapa retro-compatible nombre → glifo (string). Los consumidores que solo
 * necesitan el glifo (library-core / derivarUniversos / esquinas del podio)
 * siguen leyendo de aquí sin cambios.
 */
export const ANIMES_KANJI = Object.fromEntries(
  Object.entries(ANIMES_KANJI_ENTRIES).map(([anime, { glifo }]) => [anime, glifo]),
)

/** Kanji del universo (glifo) o undefined si el anime no tiene entrada curada. */
export function kanjiDeAnime(nombre) {
  return ANIMES_KANJI[nombre]
}

/**
 * Significado editorial del kanji del universo, o undefined si el anime no
 * tiene entrada / significado curado. Pensado para el tooltip del lomo y el
 * caption de la guarda / dossier (degrada a nada si falta).
 */
export function significadoKanjiDeAnime(nombre) {
  return ANIMES_KANJI_ENTRIES[nombre]?.significado
}
