/**
 * Fixtures compartidos de los tests del combate estelar (lib + sección de la
 * home). Viven en un .ts aparte para que los colores dominantes simulados
 * (dato de catálogo, no estilo de UI) no aparezcan en archivos .tsx/.jsx,
 * que es donde el guard de literales de color aplica el ratchet.
 */
export function personaje(slug: string, nombre: string, anime: string, color: string) {
  return {
    slug,
    nombre,
    anime,
    imagenUrl: `/img/${anime.replaceAll(' ', '_')}/${slug}.webp`,
    imagenColorDominante: color,
  }
}

export const CATALOGO = [
  personaje('luffy', 'Luffy', 'One Piece', '#aa3322'),
  personaje('zoro', 'Zoro', 'One Piece', '#226633'),
  personaje('goku', 'Goku', 'Dragon Ball', '#dd7711'),
  personaje('naruto', 'Naruto', 'Naruto', '#ddaa11'),
  personaje('sasuke', 'Sasuke', 'Naruto', '#223355'),
  personaje('tanjiro', 'Tanjiro', 'Demon Slayer', '#117755'),
  personaje('nezuko', 'Nezuko', 'Demon Slayer', '#cc5577'),
  personaje('satoru_gojo', 'Gojo', 'Jujutsu Kaisen', '#3399dd'),
  personaje('light_yagami', 'Light', 'Death Note', '#884422'),
  personaje('levi', 'Levi', 'Attack on Titan', '#445566'),
  personaje('eren', 'Eren', 'Attack on Titan', '#557744'),
  personaje('rem', 'Rem', 'Re:Zero', '#5577cc'),
]
