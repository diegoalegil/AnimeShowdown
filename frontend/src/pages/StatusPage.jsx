import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Server } from 'lucide-react'
import { endpoints } from '../lib/api'
import { formatDateSafe } from '../lib/dateUtils'
import { useSeo } from '../hooks/useSeo'
import { VisualPageShell } from '../components/VisualSystem'
import KanjiSpinner from '../components/KanjiSpinner'
import { BRAND_VISUALS } from '../data/visual-assets'

function formatPct(value) {
  if (!Number.isFinite(value)) return '0.00%'
  return `${value.toFixed(2)}%`
}

function formatLatency(value) {
  if (!value) return '0 ms'
  return `${Math.round(value)} ms`
}

function formatCheckedAt(value) {
  return formatDateSafe(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }, { locale: 'es', fallback: 'Sin muestras todavía' })
}

function statusTone(status) {
  if (status === 'UP') {
    return {
      label: 'Operativo',
      icon: CheckCircle2,
      className: 'border-success/45 bg-success/10 text-success',
      dot: 'bg-success',
    }
  }
  if (status === 'DEGRADED') {
    return {
      label: 'Degradado',
      icon: AlertTriangle,
      className: 'border-gold/45 bg-gold/10 text-gold',
      dot: 'bg-gold',
    }
  }
  return {
    label: status === 'DOWN' ? 'Incidencia' : 'Sin datos',
    icon: AlertTriangle,
    className: 'border-accent/50 bg-accent/10 text-gold',
    dot: 'bg-accent',
  }
}

function StatusMetric({ title, window }) {
  return (
    <article className="rounded-lg border border-border bg-surface/80 p-4 shadow-[0_18px_50px_-34px_var(--color-gold)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-black uppercase tracking-[0.14em] text-fg-muted">
          {title}
        </h2>
        <span className="rounded-full border border-white/10 bg-bg/70 px-2 py-1 font-mono text-[11px] text-fg-muted">
          {window?.checks ?? 0} checks
        </span>
      </div>
      <p className="font-mono text-3xl font-black tabular-nums text-fg-strong">
        {formatPct(window?.uptimePercent ?? 0)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-fg-muted">
        <span>
          p50{' '}
          <strong className="font-mono text-fg-strong">
            {formatLatency(window?.p50LatencyMs)}
          </strong>
        </span>
        <span>
          media{' '}
          <strong className="font-mono text-fg-strong">
            {formatLatency(window?.avgLatencyMs)}
          </strong>
        </span>
        <span className="col-span-2">
          muestras caídas{' '}
          <strong className="font-mono text-fg-strong">
            {window?.downChecks ?? 0}
          </strong>
        </span>
      </div>
    </article>
  )
}

function Sparkline({ samples }) {
  const points = useMemo(() => {
    if (!samples?.length) return []
    const maxLatency = Math.max(...samples.map((s) => s.latencyMs || 0), 1)
    return samples.map((sample, index) => {
      const x = samples.length === 1 ? 50 : (index / (samples.length - 1)) * 100
      const y = 88 - ((sample.latencyMs || 0) / maxLatency) * 70
      return { x, y, status: sample.status }
    })
  }, [samples])

  if (points.length < 2) {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border bg-bg/50 text-sm text-fg-muted">
        Esperando suficientes muestras para dibujar tendencia.
      </div>
    )
  }

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="rounded-lg border border-border bg-bg/50 p-4">
      <svg viewBox="0 0 100 100" className="h-44 w-full overflow-visible" role="img" aria-label="Latencia reciente del backend">
        <defs>
          <linearGradient id="statusLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-gold)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <polyline
          points={polyline}
          fill="none"
          stroke="url(#statusLine)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.x}-${index}`}
            cx={point.x}
            cy={point.y}
            r={point.status === 'UP' ? 1.6 : 2.4}
            fill={point.status === 'UP' ? '#34d399' : '#be2b38'}
          />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-fg-muted">
        <span>Más antiguo</span>
        <span>Ahora</span>
      </div>
    </div>
  )
}

function StatusPage() {
  useSeo({
    title: 'Estado del servicio',
    description:
      'Disponibilidad pública de AnimeShowdown con uptime de 24h, 7d, 30d y 90d.',
  })

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['status'],
    queryFn: endpoints.status,
    refetchInterval: 60000,
    staleTime: 15000,
    retry: 1,
  })

  const tone = statusTone(data?.currentStatus)
  const ToneIcon = tone.icon

  return (
    <VisualPageShell
      visual={{ ...BRAND_VISUALS.ranking, kanji: '健' }}
      contentClassName="mx-auto flex max-w-6xl flex-col gap-8"
      lateralKanji={{ left: '監', right: '健' }}
      className="py-10 sm:py-14"
      atmosphere="archive"
    >
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.08em] ${tone.className}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            {tone.label}
          </span>
          <span className="inline-flex items-center gap-2 text-[12px] text-fg-muted">
            <Clock3 className="h-4 w-4 text-gold" />
            Última muestra: {formatCheckedAt(data?.checkedAt)}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-gold">
              Estado público
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-fg-strong sm:text-5xl">
              AnimeShowdown Status
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-fg">
              Monitor de disponibilidad con muestras persistidas del backend,
              latencia p50 y porcentaje de uptime para las ventanas clave.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface/80 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/35 bg-gold/10 text-gold">
                <ToneIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-fg-muted">
                  API
                </p>
                <p className="font-mono text-xl font-black text-fg-strong">
                  {data?.currentStatus ?? 'UNKNOWN'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <KanjiSpinner kanji="健" size="lg" tone="gold" />
        </div>
      ) : isError ? (
        <section className="rounded-lg border border-accent/40 bg-accent/10 p-5 text-gold">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <h2 className="font-bold text-fg-strong">No se pudo cargar el estado</h2>
              <p className="mt-1 text-sm text-fg-muted">
                {error?.message || 'Inténtalo de nuevo en unos segundos.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 rounded-lg border border-accent/50 px-4 py-2 text-sm font-bold text-gold hover:bg-accent/10"
              >
                Reintentar
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatusMetric title="Últimas 24h" window={data.last24h} />
            <StatusMetric title="Últimos 7 días" window={data.last7d} />
            <StatusMetric title="Últimos 30 días" window={data.last30d} />
            <StatusMetric title="Últimos 90 días" window={data.last90d} />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-fg-muted">
                  Latencia reciente
                </h2>
              </div>
              <Sparkline samples={data.samples} />
            </div>

            <aside className="rounded-lg border border-border bg-surface/80 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Server className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-fg-muted">
                  Lectura rápida
                </h2>
              </div>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-fg-muted">Uptime 30 días</dt>
                  <dd className="font-mono text-2xl font-black text-fg-strong">
                    {formatPct(data.last30d?.uptimePercent ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">Latencia p50 30 días</dt>
                  <dd className="font-mono text-xl font-black text-fg-strong">
                    {formatLatency(data.last30d?.p50LatencyMs)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">Auto-refresh</dt>
                  <dd className="text-fg-strong">
                    {isFetching ? 'Actualizando…' : 'Cada 60 segundos'}
                  </dd>
                </div>
              </dl>
            </aside>
          </section>
        </>
      )}
    </VisualPageShell>
  )
}

export default StatusPage
