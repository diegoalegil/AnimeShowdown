const DEFAULT_LOCALE = 'es-ES'

export function parseDateSafe(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatDateSafe(value, options, { locale = DEFAULT_LOCALE, fallback = '' } = {}) {
  const date = parseDateSafe(value)
  if (!date) return fallback

  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return fallback
  }
}

export function formatRelativeSafe(
  value,
  {
    fallback = '',
    now = Date.now(),
    nowLabel = 'ahora mismo',
    minuteLabel = (amount) => `hace ${amount} min`,
    hourLabel = (amount) => `hace ${amount} h`,
    dayLabel = (amount) => `hace ${amount} d`,
    locale = DEFAULT_LOCALE,
    dateOptions = { day: 'numeric', month: 'short' },
  } = {},
) {
  const date = parseDateSafe(value)
  if (!date) return fallback

  const diffMs = now - date.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return nowLabel

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return nowLabel

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minuteLabel(minutes)

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hourLabel(hours)

  const days = Math.floor(hours / 24)
  if (days < 7) return dayLabel(days)

  return formatDateSafe(date, dateOptions, { locale, fallback })
}
