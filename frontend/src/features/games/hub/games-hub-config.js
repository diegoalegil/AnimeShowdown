import { Eye, Grid3X3, Sparkles, TrendingUp, Type } from 'lucide-react'
import { ELO_DUEL_BEST_KEY } from '../../../lib/games'

export const GAMES = [
  {
    to: '/games/shadow-guess',
    icon: Eye,
    color: 'rose',
    kanji: '影',
    titulo: 'Shadow Guess',
    sub: 'Guess the Character',
    desc: 'Silueta borrosa de un personaje. 5 intentos antes de que aparezca nítido. Acierta antes para más puntos.',
    cadencia: '1 partida al día',
    storageKey: 'animeshowdown.guess-character.v1',
    rarity: 'SSR',
    destacado: true,
  },
  {
    to: '/games/anime-reveal',
    icon: Type,
    color: 'amber',
    kanji: '謎',
    titulo: 'Anime Reveal',
    sub: 'Guess the Anime',
    desc: 'Ves al personaje pero no su anime. Pistas opcionales: nombre, ELO, anime relacionado.',
    cadencia: '1 partida al día',
    storageKey: 'animeshowdown.guess-anime.v1',
    rarity: 'SR',
  },
  {
    to: '/games/anigrid',
    icon: Grid3X3,
    color: 'emerald',
    kanji: '格',
    titulo: 'AniGrid',
    sub: 'Anidel',
    desc: 'Wordle de personajes anime. 6 intentos. Pistas opcionales gastan un intento.',
    cadencia: 'Estilo Wordle',
    storageKey: 'animeshowdown.anidel.v1',
    rarity: 'SR',
  },
  {
    to: '/games/impostor-trial',
    icon: Sparkles,
    color: 'purple',
    kanji: '裏',
    titulo: 'Impostor Trial',
    sub: 'Detector de Impostor',
    desc: '4 personajes del mismo anime + 1 traidor de otro. Detéctalo en 3 rondas.',
    cadencia: '3 rondas al día',
    storageKey: 'animeshowdown.impostor.v1',
    rarity: 'SR',
  },
  {
    to: '/games/elo-duel',
    icon: TrendingUp,
    color: 'cyan',
    kanji: '戦',
    titulo: 'ELO Duel',
    sub: 'Higher or Lower',
    desc: '¿Quién tiene más ELO base entre estos dos personajes? Adivina seguido y construye tu racha.',
    cadencia: 'Endless · sin límite',
    bestKey: ELO_DUEL_BEST_KEY,
    rarity: 'R',
    endless: true,
  },
]

// `hoverGlow` queda precompuesto para que Tailwind detecte la clase completa
// en extracción estática.
export const COLOR_THEMES = {
  rose: {
    border: 'border-danger/40',
    bg: 'bg-danger/10',
    text: 'text-danger',
    glow: 'shadow-aura-lg [--aura-color:rgb(244_63_94_/_0.55)]',
    hoverGlow: 'hover:shadow-aura-lg [--aura-color:rgb(244_63_94_/_0.55)]',
    gradient: 'from-danger/20 via-rarity-epic/10 to-rarity-epic/5',
  },
  amber: {
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    text: 'text-gold',
    glow: 'shadow-aura-lg [--aura-color:rgb(251_191_36_/_0.55)]',
    hoverGlow: 'hover:shadow-aura-lg [--aura-color:rgb(251_191_36_/_0.55)]',
    gradient: 'from-gold/20 via-medal-bronze/10 to-danger/5',
  },
  emerald: {
    border: 'border-success/40',
    bg: 'bg-success/10',
    text: 'text-success',
    glow: 'shadow-aura-lg [--aura-color:rgb(52_211_153_/_0.55)]',
    hoverGlow: 'hover:shadow-aura-lg [--aura-color:rgb(52_211_153_/_0.55)]',
    gradient: 'from-success/20 via-electric/10 to-info/5',
  },
  purple: {
    border: 'border-rarity-epic/40',
    bg: 'bg-rarity-epic/10',
    text: 'text-rarity-epic',
    glow: 'shadow-aura-lg [--aura-color:rgb(168_85_247_/_0.55)]',
    hoverGlow: 'hover:shadow-aura-lg [--aura-color:rgb(168_85_247_/_0.55)]',
    gradient: 'from-rarity-epic/20 via-rarity-epic/10 to-arc-waifu/5',
  },
  cyan: {
    border: 'border-electric/40',
    bg: 'bg-electric/10',
    text: 'text-electric',
    glow: 'shadow-aura-lg [--aura-color:rgb(34_211_238_/_0.55)]',
    hoverGlow: 'hover:shadow-aura-lg [--aura-color:rgb(34_211_238_/_0.55)]',
    gradient: 'from-electric/20 via-info/10 to-arc-husbando/5',
  },
}

export function gamesHubSchema(games) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Anime Daily Trials — AnimeShowdown',
    url: 'https://animeshowdown.dev/games',
    inLanguage: 'es-ES',
    description:
      'Hub de retos diarios de anime con juegos de adivinar personajes, detectar impostores y competir por rachas.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'AnimeShowdown',
      url: 'https://animeshowdown.dev/',
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: games.length,
      itemListElement: games.map((game, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebApplication',
          name: game.titulo,
          alternateName: game.sub,
          url: `https://animeshowdown.dev${game.to}`,
          applicationCategory: 'GameApplication',
          operatingSystem: 'Web',
          description: game.desc,
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'EUR',
          },
        },
      })),
    },
    about: [
      'anime games online',
      'daily anime quiz',
      'anime higher or lower',
      'anime character guessing game',
    ],
  }
}
