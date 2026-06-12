/**
 * Kanji de universo — UN kanji con significado real por anime, para las
 * esquinas selladas del podio (y cualquier superficie que quiera firmar
 * un universo). Curado a mano: solo entradas defendibles (del título
 * original o del concepto central de la obra); un anime sin entrada
 * simplemente no pinta kanji (jamás japonés de relleno).
 *
 * Claves = nombre visible del catálogo (`personaje.anime`).
 */
export const ANIMES_KANJI = {
  'One Piece': '海', // el mar — la Grand Line entera
  'Naruto': '忍', // shinobi
  'Dragon Ball': '龍', // el dragón Shenron
  'Bleach': '死', // shinigami (死神)
  'Jujutsu Kaisen': '呪', // la maldición del título (呪術廻戦)
  'Demon Slayer': '鬼', // los oni de Kimetsu no Yaiba (鬼滅の刃)
  'Attack on Titan': '巨', // los gigantes (進撃の巨人)
  'Hunter x Hunter': '狩', // la caza
  'My Hero Academia': '英', // héroe (英雄)
  'Death Note': '裁', // el juicio de Kira
  'Fullmetal Alchemist': '錬', // alquimia (錬金術)
  'One Punch Man': '拳', // el puño
  'Tokyo Ghoul': '喰', // devorar — del título original (東京喰種)
  'Sword Art Online': '剣', // la espada
  'Neon Genesis Evangelion': '使', // los ángeles/shito (使徒)
  'Gintama': '銀', // la plata del título (銀魂)
}

/** Kanji del universo o undefined si el anime no tiene entrada curada. */
export function kanjiDeAnime(nombre) {
  return ANIMES_KANJI[nombre]
}
