import { getPersonajeBySlug } from '../../lib/personajes-core'

export const SLOTS = 5
export const STORAGE_KEY = 'animeshowdown.mitop5.v1'

export const SUGERENCIAS_RAPIDAS_SLUGS = [
  'luffy',
  'naruto_uzumaki',
  'satoru_gojo',
  'son_goku',
  'levi_ackerman',
  'roronoa_zoro',
  'tanjiro_kamado',
  'eren_yeager',
]

export function readStoredSlots() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return Array(SLOTS).fill(null)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return Array(SLOTS).fill(null)
    return parsed
      .slice(0, SLOTS)
      .concat(Array(SLOTS).fill(null))
      .slice(0, SLOTS)
  } catch {
    return Array(SLOTS).fill(null)
  }
}

export function getTop5AddSlugs(searchParams) {
  return [
    ...new Set(
      searchParams
        .getAll('add')
        .flatMap((value) => String(value).split(','))
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ].slice(0, SLOTS)
}

export function buildInitialSlots(addSlugs = []) {
  const slots = readStoredSlots()
  return mergeTop5AddSlugs(slots, addSlugs)
}

export function mergeTop5AddSlugs(slots, addSlugs = []) {
  const next = [...slots]
  for (const slug of addSlugs) {
    if (!getPersonajeBySlug(slug) || next.includes(slug)) continue
    const idx = next.findIndex((slot) => !slot)
    if (idx === -1) break
    next[idx] = slug
  }
  return next
}
