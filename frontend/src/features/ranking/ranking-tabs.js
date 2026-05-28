import {
  Calendar,
  Sparkles,
  Trophy,
  Tv,
  Vote,
} from 'lucide-react'

// Orden deliberado: primero las pestañas con datos REALES de votos
// (Histórico / Este mes / Por anime). "ELO base" es una estimación por
// popularidad y va etiquetada como tal, después de los datos reales — antes
// era la pestaña por defecto y exhibía un ranking sintético como si fuera real.
export const RANKING_TABS = [
  { id: 'all', label: 'Histórico', icon: Vote },
  { id: 'mes', label: 'Este mes', icon: Calendar },
  { id: 'elo', label: 'ELO base', icon: Trophy },
  { id: 'categorias', label: 'Categorías', icon: Sparkles },
  { id: 'anime', label: 'Por anime', icon: Tv },
]
