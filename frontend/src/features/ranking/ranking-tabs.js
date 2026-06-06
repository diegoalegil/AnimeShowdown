import {
  Calendar,
  Sparkles,
  Trophy,
  Tv,
  Vote,
} from 'lucide-react'

// "ELO" = ranking canónico (semilla por popularidad +15% femenino + ajuste por
// votos, calculado en el backend). "Histórico" / "Este mes" son el ranking por
// VOLUMEN de votos en vivo (WebSocket). Ambos son datos reales; difieren en qué
// miden (posición canónica vs actividad de votos en una ventana).
export const RANKING_TABS = [
  { id: 'all', label: 'Histórico', icon: Vote },
  { id: 'mes', label: 'Este mes', icon: Calendar },
  { id: 'elo', label: 'ELO', icon: Trophy },
  { id: 'categorias', label: 'Categorías', icon: Sparkles },
  { id: 'anime', label: 'Por anime', icon: Tv },
]
