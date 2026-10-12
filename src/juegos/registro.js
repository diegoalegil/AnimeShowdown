// Los minijuegos: qué hay, cómo se llama cada uno y de dónde se descarga su
// código. Es la única lista; de aquí salen el hub (/juegos), las rutas
// (/juegos/<slug>), sus páginas prerenderizadas (scripts/prerender.mjs) y
// el progreso guardado. No importa React ni el navegador: el prerender lo
// carga en Node.
//
// Cada juego:
//   slug         carpeta en src/juegos/<slug>/ y tramo final de su dirección
//   nombre       como se muestra
//   kanji        un carácter que lo distingue (sello del hub y de su cabecera)
//   descripcion  una frase, para el hub y la descripción de su página
//   acento       color de su marco: 'carmesi' | 'oro' | 'cian' (ver styles/juegos.css)
//   recompensa   true si cada ronda ganada da un sobre extra (ver comun/recompensa.js)
//   cargar       import() de su pantalla: export default function Juego({ juego })

export const JUEGOS = [
  {
    slug: 'silueta',
    nombre: 'Silueta',
    kanji: '影',
    descripcion: 'Adivina quién es por su silueta. Cada fallo destapa un panel.',
    acento: 'carmesi',
    recompensa: true,
    cargar: () => import('./silueta/index.jsx'),
  },
  {
    slug: 'revelar-serie',
    nombre: '¿De qué serie?',
    kanji: '謎',
    descripcion: 'Ves al personaje, pero no su serie. Acierta de dónde viene, con pistas si las necesitas.',
    acento: 'oro',
    recompensa: true,
    cargar: () => import('./revelar-serie/index.jsx'),
  },
  {
    slug: 'anigrid',
    nombre: 'AniGrid',
    kanji: '格',
    descripcion: 'Seis intentos para dar con el personaje; cada uno compara serie, inicial, letras, número, popularidad y género.',
    acento: 'cian',
    recompensa: true,
    cargar: () => import('./anigrid/index.jsx'),
  },
  {
    slug: 'nexo',
    nombre: 'Nexo',
    kanji: '結',
    descripcion: 'Ocho cartas, cuatro parejas de la misma serie. Únelas, y rápido.',
    acento: 'oro',
    recompensa: true,
    cargar: () => import('./nexo/index.jsx'),
  },
  {
    slug: 'impostor',
    nombre: 'Impostor',
    kanji: '裏',
    descripcion: 'Cuatro de una serie y un intruso. Tres rondas para descubrirlo.',
    acento: 'carmesi',
    recompensa: true,
    cargar: () => import('./impostor/index.jsx'),
  },
  {
    slug: 'oraculo',
    nombre: 'Oráculo',
    kanji: '心',
    descripcion: 'Piensa un personaje y responde sí o no. El oráculo lo adivina.',
    acento: 'cian',
    recompensa: true,
    cargar: () => import('./oraculo/index.jsx'),
  },
  {
    slug: 'popularidad',
    nombre: '¿Quién es más popular?',
    kanji: '推',
    descripcion: '¿Cuál de los dos tiene más favoritos en AniList? Acierta seguido y alarga la racha.',
    acento: 'carmesi',
    recompensa: true,
    cargar: () => import('./popularidad/index.jsx'),
  },
  {
    slug: 'ruleta',
    nombre: 'Ruleta del destino',
    kanji: '運',
    descripcion: 'Gira el tambor y deja que el azar elija a tu campeón.',
    acento: 'oro',
    recompensa: false,
    cargar: () => import('./ruleta/index.jsx'),
  },
  {
    slug: 'omikuji',
    nombre: 'Omikuji',
    kanji: '吉',
    descripcion: 'La suerte del día: sacude la caja, saca tu varilla y lee tu fortuna.',
    acento: 'cian',
    recompensa: false,
    cargar: () => import('./omikuji/index.jsx'),
  },
  {
    slug: 'top5',
    nombre: 'Mi Top 5',
    kanji: '五',
    descripcion: 'Elige tus cinco cartas y crea una imagen para compartir.',
    acento: 'oro',
    recompensa: false,
    cargar: () => import('./top5/index.jsx'),
  },
]

/** Slugs de todos los juegos, en el orden del hub. */
export const SLUGS = JUEGOS.map((j) => j.slug)

/** El juego de un slug de la dirección, o undefined si no existe. */
export const juegoPorSlug = (slug) => JUEGOS.find((j) => j.slug === slug)
