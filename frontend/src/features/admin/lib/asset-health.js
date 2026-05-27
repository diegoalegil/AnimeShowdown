import { CUT_SLUGS } from '../../../data/cut-slugs'
import {
  ANIME_VISUALS,
  BRAND_VISUALS,
  EVENT_VISUALS,
  GAME_VISUALS,
  TOURNAMENT_VISUALS,
} from '../../../data/visual-assets'
import { VISUAL_ASSET_PATHS } from '../../../data/visual-assets-manifest'
import { readCatalogoPersonajesSnapshot } from '../../../lib/personajes-core'

const VISUAL_GROUPS = [
  { type: 'anime', label: 'Anime', entries: ANIME_VISUALS },
  { type: 'tournament', label: 'Torneos', entries: TOURNAMENT_VISUALS },
  { type: 'event', label: 'Eventos', entries: EVENT_VISUALS },
  { type: 'game', label: 'Juegos', entries: GAME_VISUALS },
  { type: 'brand', label: 'Marca', entries: BRAND_VISUALS },
]

const BANNER_BUCKETS = [
  'anime-banners',
  'character-banners',
  'tournament-banners',
]

const SSR_BUCKETS = ['character-cards', 'character-portraits']

export function getCutCoverage(
  catalogo = readCatalogoPersonajesSnapshot(),
) {
  const cutSlugs = new Set(CUT_SLUGS.map(normalizeSlug))
  const personajes = Array.isArray(catalogo) ? catalogo : []
  const missing = personajes
    .filter((personaje) => {
      const slug = normalizeSlug(personaje?.slug)
      return slug && !cutSlugs.has(slug)
    })
    .map((personaje) => ({
      slug: personaje.slug,
      nombre: personaje.nombre ?? personaje.slug,
      anime: personaje.anime ?? 'Anime desconocido',
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug))

  return {
    total: personajes.length,
    available: personajes.length - missing.length,
    missing,
  }
}

export function getVisualManifestIssues() {
  return VISUAL_GROUPS.flatMap((group) =>
    Object.values(group.entries).flatMap((visual) =>
      [
        buildManifestIssue(group, visual, 'image', visual.expectedPath),
        buildManifestIssue(
          group,
          visual,
          'shellImage',
          visual.shellExpectedPath,
        ),
      ].filter(Boolean),
    ),
  )
}

export function buildFallbackTypeRows(coverage, cutCoverage, manifestIssues) {
  const ssrTotals = sumBuckets(coverage, SSR_BUCKETS)
  const bannerTotals = sumBuckets(coverage, BANNER_BUCKETS)
  const brandTotal = countExpectedVisualPaths(BRAND_VISUALS)
  const brandMissing = manifestIssues.filter(
    (issue) => issue.type === 'brand',
  ).length

  return [
    {
      id: 'cuts',
      label: 'Cuts',
      total: cutCoverage.total,
      missing: cutCoverage.missing.length,
      detail: `${cutCoverage.available} slugs con recorte transparente`,
    },
    {
      id: 'ssr',
      label: 'SSR',
      total: ssrTotals.totalSlots,
      missing: ssrTotals.fallbackSlots,
      detail: `${ssrTotals.realAssets} assets reales en cards/retratos`,
    },
    {
      id: 'banners',
      label: 'Banners',
      total: bannerTotals.totalSlots,
      missing: bannerTotals.fallbackSlots,
      detail: `${bannerTotals.realAssets} banners reales en catálogo`,
    },
    {
      id: 'brand',
      label: 'Brand',
      total: brandTotal,
      missing: brandMissing,
      detail: `${brandTotal - brandMissing} visuales de marca en manifest`,
    },
  ]
}

export function buildAssetHealthMarkdown({
  coverage,
  fallbackStats,
  cutCoverage,
  manifestIssues,
  fallbackRows,
}) {
  const generatedAt = coverage?.generatedAt ?? new Date().toISOString()
  const errors = fallbackStats?.errors ?? []
  return [
    '# Asset health',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Coverage',
    '',
    `- Total slots: ${coverage?.totalSlots ?? 0}`,
    `- Real assets: ${coverage?.realAssets ?? 0} (${formatPercent(coverage?.realAssetPercent)}%)`,
    `- Fallback slots: ${coverage?.fallbackSlots ?? 0} (${formatPercent(coverage?.fallbackPercent)}%)`,
    '',
    '## Fallbacks by type',
    '',
    ...fallbackRows.map(
      (row) => `- ${row.label}: ${row.missing}/${row.total} missing`,
    ),
    '',
    '## Slugs without cut',
    '',
    ...markdownList(
      cutCoverage.missing.map((item) => `${item.slug} (${item.anime})`),
    ),
    '',
    '## Visual manifest issues',
    '',
    ...markdownList(
      manifestIssues.map(
        (issue) => `${issue.type}/${issue.slug} ${issue.field}: ${issue.path}`,
      ),
    ),
    '',
    '## Latest tracked image errors',
    '',
    ...markdownList(
      errors.map(
        (error) =>
          `${error.category}: ${error.src} (${error.count}x, last ${error.lastAt})`,
      ),
    ),
  ].join('\n')
}

function buildManifestIssue(group, visual, field, path) {
  if (!path || VISUAL_ASSET_PATHS.has(path)) return null
  return {
    type: group.type,
    group: group.label,
    slug: visual.slug,
    title: visual.title,
    field,
    path,
  }
}

function countExpectedVisualPaths(entries) {
  return Object.values(entries).reduce((count, visual) => {
    const paths = [visual.expectedPath, visual.shellExpectedPath].filter(Boolean)
    return count + paths.length
  }, 0)
}

function sumBuckets(coverage, names) {
  const buckets = coverage?.buckets ?? []
  return buckets
    .filter((bucket) => names.includes(bucket.category))
    .reduce(
      (acc, bucket) => ({
        totalSlots: acc.totalSlots + Number(bucket.totalSlots ?? 0),
        realAssets: acc.realAssets + Number(bucket.realAssets ?? 0),
        fallbackSlots: acc.fallbackSlots + Number(bucket.fallbackSlots ?? 0),
      }),
      { totalSlots: 0, realAssets: 0, fallbackSlots: 0 },
    )
}

function markdownList(items) {
  if (items.length === 0) return ['- none']
  return items.slice(0, 40).map((item) => `- ${item}`)
}

function normalizeSlug(value) {
  return String(value ?? '').trim().toLowerCase()
}

function formatPercent(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toFixed(1).replace('.0', '') : '0'
}
