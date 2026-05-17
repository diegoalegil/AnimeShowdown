/**
 * Mapa estático de iconos lucide usados por los 14 badges del catálogo.
 *
 * <p>Antes BadgeCard hacía {@code import * as Icons from 'lucide-react'} y
 * luego {@code Icons[nombre]} para resolver por string. Eso rompía el
 * tree-shaking y traía los ~700 iconos de lucide al bundle inicial
 * (+150KB gzip). Ahora importamos solo los 14 que el seed referencia
 * (V7 + futuros) y resolvemos por mapa estático.
 *
 * <p>Si llega un badge con icono no contemplado (p.ej. después de añadir
 * uno nuevo al seed sin actualizar este mapa), {@link iconoDeBadge}
 * devuelve {@code Award} como fallback — visible pero genérico, no
 * rompe la UI.
 */
import {
  Award,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Skull,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'

const BADGE_ICONS = {
  Award,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Skull,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
}

export function iconoDeBadge(nombre) {
  return BADGE_ICONS[nombre] ?? Award
}
