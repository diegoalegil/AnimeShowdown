import { Link } from 'react-router-dom'
import MonedaIcon from './MonedaIcon'
import { useSaldo } from '../hooks/useCartas'

/**
 * Indicador global de saldo de monedas en la cabecera (solo usuario logueado).
 * Hace visible el wallet —antes solo dentro de /cartas— y enlaza ahí. Si no hay
 * saldo aún (cargando / sin sesión) no renderiza nada.
 */
function SaldoChip({ className = '' }) {
  const { data } = useSaldo()
  const saldo = data?.saldo
  if (saldo == null) return null
  return (
    <Link
      to="/cartas"
      aria-label={`${saldo} monedas`}
      title={`${saldo} monedas`}
      className={`inline-flex items-center gap-1 rounded-lg border border-white/12 bg-black/30 px-2 py-1 text-sm font-bold text-gold transition-colors hover:border-gold/50 ${className}`}
    >
      <MonedaIcon className="h-4 w-4" />
      <span>{saldo}</span>
    </Link>
  )
}

export default SaldoChip
