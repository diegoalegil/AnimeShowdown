/**
 * Indicador visual de fortaleza de password.
 *
 * Lógica heurística simple en lugar de zxcvbn (que pesa ~100KB minified)
 * — para el nivel de exigencia del proyecto basta con:
 *   - puntaje +1 por longitud >= 8 (mínimo que también exige el backend)
 *   - puntaje +1 por longitud >= 12
 *   - puntaje +1 si mezcla mayúsculas y minúsculas
 *   - puntaje +1 por dígitos
 *   - puntaje +1 por símbolos (no alfanum)
 * Capa final 0..4 + label en español.
 *
 * El backend ya valida la regla mínima con @Pattern; este componente solo
 * da feedback visual mientras el usuario teclea.
 */

const ETIQUETAS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente']
const COLORES = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-emerald-500',
  'bg-emerald-400',
]

// eslint-disable-next-line react-refresh/only-export-components
export function evaluarPassword(pass) {
  if (!pass) return { score: 0, label: 'Muy débil', color: COLORES[0] }
  // Regla mínima real (misma que el schema zod y el backend):
  // al menos una letra Y al menos un dígito. Si no se cumple → 0.
  const tieneLetra = /[A-Za-z]/.test(pass)
  const tieneDigito = /\d/.test(pass)
  if (!tieneLetra || !tieneDigito) {
    return { score: 0, label: 'Muy débil', color: COLORES[0] }
  }
  let score = 0
  if (pass.length >= 8) score += 1
  if (pass.length >= 12) score += 1
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1
  if (/[^a-zA-Z0-9]/.test(pass)) score += 1
  // Penalización por repeticiones largas tipo "aaaaaa" o "111111".
  if (/(.)\1{3,}/.test(pass)) score = Math.max(0, score - 1)
  score = Math.min(score, 4)
  return { score, label: ETIQUETAS[score], color: COLORES[score] }
}

function PasswordStrengthMeter({ password, className = '' }) {
  if (!password) return null
  const { score, label, color } = evaluarPassword(password)
  const pct = ((score + 1) / 5) * 100 // Empezamos con barra ~20% para que se vea algo desde el primer char.
  return (
    <div className={`mt-2 flex flex-col gap-1 ${className}`}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className={`h-full ${color} transition-all duration-200`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-fg-muted">
        Fortaleza: <span className="font-semibold text-fg-strong">{label}</span>
      </p>
    </div>
  )
}

export default PasswordStrengthMeter
