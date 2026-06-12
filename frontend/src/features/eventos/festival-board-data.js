/* Formateadores y estado temporal del FestivalBoard. Módulo hermano:
   el .jsx solo exporta componentes (fast-refresh). */

const MIN = 60_000
const HORA = 3_600_000
const DIA = 86_400_000

export const pad = (n) => String(n).padStart(2, '0')

/** ≥48h → "12 d" · <24h → "07 h 23 m" · <1h → "41 m 32 s". */
export function formatCuentaAtras(ms) {
  if (ms <= 0) return '00 m 00 s'
  if (ms >= 48 * HORA) return `${Math.ceil(ms / DIA)} d`
  if (ms >= HORA) return `${pad(Math.floor(ms / HORA))} h ${pad(Math.floor((ms % HORA) / MIN))} m`
  return `${pad(Math.floor(ms / MIN))} m ${pad(Math.floor((ms % MIN) / 1000))} s`
}

export function formatAriaSpan(ms) {
  if (ms >= 2 * DIA) return `${Math.round(ms / DIA)} días`
  if (ms >= HORA) {
    const h = Math.floor(ms / HORA)
    const m = Math.floor((ms % HORA) / MIN)
    return `${h} ${h === 1 ? 'hora' : 'horas'}${m ? ` y ${m} minutos` : ''}`
  }
  return `${Math.max(1, Math.floor(ms / MIN))} minutos`
}

/** Estado temporal derivado — única verdad para los tres tratamientos. */
export function estadoDe(evento, now) {
  if (now < evento.inicio.getTime()) return 'futuro'
  if (now < evento.fin.getTime()) return 'activo'
  return 'pasado'
}

