import {
  Calendar,
  Sparkles,
  Trophy,
  Tv,
  Vote,
} from 'lucide-react'

export const RANKING_TABS = [
  { id: 'elo', label: 'ELO actual', icon: Trophy },
  { id: 'categorias', label: 'Categorías', icon: Sparkles },
  { id: 'all', label: 'Histórico', icon: Vote },
  { id: 'mes', label: 'Este mes', icon: Calendar },
  { id: 'anime', label: 'Por anime', icon: Tv },
]
