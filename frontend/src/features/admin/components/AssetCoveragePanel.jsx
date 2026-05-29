import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileWarning,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import EmptyState from '../../../components/EmptyState'
import Skeleton from '../../../components/Skeleton'
import { endpoints } from '../../../lib/api'
import {
  clearAssetFallbackStats,
  useAssetFallbackStats,
} from '../../../lib/asset-tracking'
import {
  buildAssetHealthMarkdown,
  buildFallbackTypeRows,
  getCutCoverage,
  getVisualManifestIssues,
} from '../lib/asset-health'

function AssetCoveragePanel() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'assets', 'coverage'],
    queryFn: endpoints.adminAssetCoverage,
    refetchInterval: 60_000,
  })
  const fallbackStats = useAssetFallbackStats()

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="line" className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se pudo cargar cobertura de assets"
        description="Revisa que el backend tenga permisos de lectura sobre los seeds y la estructura local del frontend."
      />
    )
  }

  const buckets = data?.buckets ?? []
  const cutCoverage = getCutCoverage()
  const manifestIssues = getVisualManifestIssues()
  const fallbackRows = buildFallbackTypeRows(data, cutCoverage, manifestIssues)
  const trackedErrors = fallbackStats.errors ?? []
  const markdownReport = buildAssetHealthMarkdown({
    coverage: data,
    fallbackStats,
    cutCoverage,
    manifestIssues,
    fallbackRows,
  })
  const localFallbackEntries = Object.entries(fallbackStats.byCategory ?? {})
    .sort((a, b) => b[1] - a[1])
  const totals = [
    {
      label: 'Slots totales',
      value: data?.totalSlots ?? 0,
      detail: 'Seeds y slots visuales esperados',
    },
    {
      label: 'Asset real',
      value: `${formatPercent(data?.realAssetPercent)}%`,
      detail: `${data?.realAssets ?? 0} slots cubiertos`,
    },
    {
      label: 'AssetFallback',
      value: `${formatPercent(data?.fallbackPercent)}%`,
      detail: `${data?.fallbackSlots ?? 0} slots sin asset dedicado`,
    },
  ]
  const handleCopyReport = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard no disponible')
      }
      await navigator.clipboard.writeText(markdownReport)
      toast.success('Reporte de assets copiado')
    } catch (error) {
      toast.error('No se pudo copiar el reporte', {
        description: error?.message,
      })
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-lg font-bold text-fg-strong">
            Cobertura visual
          </h2>
          <p className="text-[12px] text-fg-muted">
            Conteo admin-only de slugs del catálogo frente a assets WebP
            locales.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:bg-surface-alt"
          >
            <Copy className="h-4 w-4" />
            Copiar reporte
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-fg-strong transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
            Actualizar
          </button>
        </div>
      </div>

      {!data?.filesystemAvailable && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          El backend no encontró la carpeta local del frontend. La cobertura se
          mostrará completa en entornos donde el repo esté disponible en disco.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-black text-fg-strong">
              {item.value}
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fallbackRows.map((row) => {
          const isHealthy = row.missing === 0
          const Icon = isHealthy ? CheckCircle2 : FileWarning
          return (
            <div
              key={row.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">
                  {row.label}
                </p>
                <Icon
                  className={`h-4 w-4 ${
                    isHealthy ? 'text-success' : 'text-gold'
                  }`}
                />
              </div>
              <p className="mt-2 text-2xl font-black text-fg-strong">
                {row.missing}
              </p>
              <p className="mt-1 text-[12px] text-fg-muted">
                {row.detail}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-fg-strong">
              Uso local de AssetFallback
            </h3>
            <p className="text-[12px] text-fg-muted">
              Contador de esta sesión del navegador, agrupado por tipo de
              fallback.
            </p>
          </div>
          <button
            type="button"
            onClick={clearAssetFallbackStats}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-[12px] font-semibold text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg-strong"
          >
            Reiniciar
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">
              Total local
            </p>
            <p className="mt-1 text-2xl font-black text-fg-strong">
              {fallbackStats.total}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-bg p-3 sm:col-span-2">
            {localFallbackEntries.length === 0 ? (
              <p className="text-sm text-fg-muted">
                Aún no se ha renderizado ningún fallback en esta sesión.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {localFallbackEntries.map(([category, count]) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-1 text-[12px] text-fg"
                  >
                    <span className="font-semibold text-fg-strong">
                      {formatFallbackCategory(category)}
                    </span>
                    <span className="font-mono text-fg-muted">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DiagnosticsCard
          title="Slugs sin cut"
          description="Catálogo hidratado frente a frontend/img/cuts."
          count={cutCoverage.missing.length}
          emptyText="Todos los personajes hidratados tienen cut."
          items={cutCoverage.missing}
          renderItem={(item) => (
            <>
              <span className="truncate font-mono text-fg-strong">
                {item.slug}
              </span>
              <span className="truncate text-fg-muted">{item.anime}</span>
            </>
          )}
        />
        <DiagnosticsCard
          title="Manifest visual"
          description="expectedPath y shellExpectedPath ausentes del manifest."
          count={manifestIssues.length}
          emptyText="El registro visual y el manifest están sincronizados."
          items={manifestIssues}
          renderItem={(item) => (
            <>
              <span className="truncate font-semibold text-fg-strong">
                {item.group} · {item.slug}
              </span>
              <span className="truncate font-mono text-fg-muted">
                {item.field}: {item.path}
              </span>
            </>
          )}
        />
        <DiagnosticsCard
          title="Últimos errores"
          description="Errores de carga de imagen reportados en esta sesión."
          count={trackedErrors.length}
          emptyText="Sin errores de imagen trackeados en esta sesión."
          items={trackedErrors}
          renderItem={(item) => (
            <>
              <span className="truncate font-mono text-fg-strong">
                {item.category} · {item.count}x
              </span>
              <span className="truncate text-fg-muted">{item.src}</span>
            </>
          )}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] gap-3 border-b border-border px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">
          <span>Categoría</span>
          <span>Total</span>
          <span>Real</span>
          <span>Fallback</span>
        </div>
        <div className="divide-y divide-border">
          {buckets.map((bucket) => (
            <div
              key={bucket.category}
              className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg-strong">
                  {formatAssetCategory(bucket.category)}
                </p>
                <p className="text-[11px] text-fg-muted">
                  {formatPercent(bucket.realAssetPercent)}% cubierto
                </p>
              </div>
              <span className="font-mono text-fg-muted">
                {bucket.totalSlots}
              </span>
              <span className="font-mono text-success">
                {bucket.realAssets}
              </span>
              <span className="font-mono text-gold">
                {bucket.fallbackSlots}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DiagnosticsCard({
  title,
  description,
  count,
  emptyText,
  items,
  renderItem,
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-fg-strong">{title}</h3>
          <p className="text-[12px] text-fg-muted">{description}</p>
        </div>
        <span className="rounded-full border border-border bg-bg px-2.5 py-1 font-mono text-[11px] text-fg-muted">
          {count}
        </span>
      </div>
      <div className="mt-4 grid max-h-64 gap-2 overflow-auto pr-1">
        {items.length === 0 ? (
          <p className="rounded-lg border border-border bg-bg p-3 text-sm text-fg-muted">
            {emptyText}
          </p>
        ) : (
          items.slice(0, 12).map((item) => (
            <div
              key={`${title}-${item.slug ?? item.key ?? item.path}`}
              className="grid gap-1 rounded-lg border border-border bg-bg p-3 text-[12px]"
            >
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function formatPercent(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toFixed(1).replace('.0', '') : '0'
}

function formatAssetCategory(value) {
  const labels = {
    'character-cards': 'Cards de personaje',
    'character-portraits': 'Retratos de personaje',
    'character-banners': 'Banners de personaje',
    'anime-banners': 'Banners de anime',
    'tournament-banners': 'Banners de torneo',
  }
  return labels[value] ?? value
}

function formatFallbackCategory(value) {
  const labels = {
    character: 'Personaje',
    anime: 'Anime',
    tournament: 'Torneo',
    unknown: 'Otro',
  }
  return labels[value] ?? value
}

export default AssetCoveragePanel
