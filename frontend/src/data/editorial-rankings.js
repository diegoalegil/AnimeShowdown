export const EDITORIAL_RANKING_PAGES = [
  {
    slug: 'mejores-personajes-anime',
    title: 'Mejores personajes de anime',
    h1: 'Mejores personajes de anime',
    eyebrow: 'Ranking editorial · top global',
    description:
      'Ranking de los mejores personajes de anime en AnimeShowdown, ordenado por ELO base y señales competitivas del catálogo.',
    intro:
      'Una entrada directa para quien busca un top general sin tener que entender primero todos los modos de AnimeShowdown.',
    source: { kind: 'global' },
    scoreLabel: 'ELO base',
    intent: 'mejores personajes anime',
  },
  {
    slug: 'personajes-mas-fuertes-anime',
    title: 'Personajes más fuertes de anime',
    h1: 'Personajes más fuertes de anime',
    eyebrow: 'Ranking editorial · power scaling',
    description:
      'Top de personajes frecuentes en debates de poder dentro del anime. No es canon oficial: es una lectura competitiva para votar y comparar.',
    intro:
      'Pensado para búsquedas de power scaling: personajes que suelen aparecer cuando la conversación va de fuerza, dominio o duelos imposibles.',
    source: { kind: 'category', id: 'power-scaling' },
    scoreLabel: 'ELO base',
    intent: 'personajes más fuertes anime',
  },
  {
    slug: 'mejores-villanos-anime',
    title: 'Mejores villanos de anime',
    h1: 'Mejores villanos de anime',
    eyebrow: 'Ranking editorial · villanos',
    description:
      'Ranking de villanos de anime en AnimeShowdown: antagonistas icónicos ordenados para votar, comparar y mover el meta.',
    intro:
      'Villanos memorables, antagonistas temibles y personajes que hacen que una serie se sienta peligrosa.',
    source: { kind: 'category', id: 'villain' },
    scoreLabel: 'ELO base',
    intent: 'mejores villanos anime',
  },
  {
    slug: 'mejores-waifus-anime',
    title: 'Mejores waifus de anime',
    h1: 'Mejores waifus de anime',
    eyebrow: 'Ranking editorial · fandom',
    description:
      'Top de personajes femeninos icónicos del fandom anime en AnimeShowdown, con fichas, duelos y ranking compartible.',
    intro:
      'Una página de fandom, no de canon: personajes femeninos muy reconocibles que la comunidad puede subir o bajar votando.',
    source: { kind: 'category', id: 'waifu' },
    scoreLabel: 'ELO base',
    intent: 'mejores waifus anime',
  },
  {
    slug: 'mejores-protagonistas-anime',
    title: 'Mejores protagonistas de anime',
    h1: 'Mejores protagonistas de anime',
    eyebrow: 'Ranking editorial · protagonistas',
    description:
      'Ranking de protagonistas de anime en AnimeShowdown: héroes principales, antihéroes y líderes de serie listos para votar.',
    intro:
      'El punto de entrada para comparar protagonistas sin mezclar todo el catálogo: cada puesto enlaza a ficha y duelo.',
    source: { kind: 'category', id: 'protagonist' },
    scoreLabel: 'ELO base',
    intent: 'mejores protagonistas anime',
  },
]

export function getEditorialRankingPage(slug) {
  return EDITORIAL_RANKING_PAGES.find((page) => page.slug === slug) ?? null
}
