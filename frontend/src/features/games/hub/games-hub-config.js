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
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/10',
    text: 'text-rose-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(244,63,94,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(244,63,94,0.55)]',
    gradient: 'from-rose-500/20 via-fuchsia-500/10 to-purple-500/5',
  },
  amber: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(251,191,36,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(251,191,36,0.55)]',
    gradient: 'from-amber-500/20 via-orange-500/10 to-rose-500/5',
  },
  emerald: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(52,211,153,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(52,211,153,0.55)]',
    gradient: 'from-emerald-500/20 via-cyan-500/10 to-blue-500/5',
  },
  purple: {
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
    text: 'text-purple-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(168,85,247,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.55)]',
    gradient: 'from-purple-500/20 via-fuchsia-500/10 to-pink-500/5',
  },
  cyan: {
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-200',
    glow: 'shadow-[0_0_60px_-15px_rgba(34,211,238,0.55)]',
    hoverGlow: 'hover:shadow-[0_0_60px_-15px_rgba(34,211,238,0.55)]',
    gradient: 'from-cyan-500/20 via-sky-500/10 to-indigo-500/5',
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
