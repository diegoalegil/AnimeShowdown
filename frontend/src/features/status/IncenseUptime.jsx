import { formatDateSafe } from '../../lib/dateUtils'

/**
 * IncenseUptime — el uptime como vara de incienso.
 *
 * Estático, pura semántica (cero animación, cero canvas): cada segmento de
 * la vara es una MUESTRA persistida del monitor; una caída es un hueco
 * carbonizado (esa muestra se quemó mal). El extremo derecho (ahora) lleva
 * la brasa: un punto bermellón con halo pre-renderizado vía shadow-aura-sm
 * — sin blur ni filters.
 *
 * El % gigante es EL dato de la sala y viene de la ventana de 90 días del
 * backend; la vara enseña el grano fino (las últimas muestras). Las dos
 * etiquetas lo dicen explícitamente — datos reales, sin teatro.
 *
 * Props:
 *   segments       [{ date, status: 'UP'|'DEGRADED'|'DOWN' }]  (viejo→ahora)
 *   uptimePercent  número (la ventana que diga uptimeLabel)
 *   uptimeLabel    default 'últimos 90 días'
 *   rodLabel       default 'últimas muestras del monitor'
 */

function formatPct(value) {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

const SEGMENT_LABEL = { UP: 'operativo', DEGRADED: 'degradado', DOWN: 'caída' }

function IncenseSegment({ segment, isNow }) {
  const cuando = formatDateSafe(segment.date, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, { locale: 'es', fallback: '' })
  const title = `${cuando} — ${SEGMENT_LABEL[segment.status] ?? 'sin datos'}`
  // UP: vara dorada. DEGRADED: oro ceniciento. DOWN: hueco carbonizado —
  // el segmento casi desaparece y deja muñón oscuro con rescoldo carmesí.
  let cls = 'h-1.5 bg-gold'
  if (segment.status === 'DEGRADED') cls = 'h-1.5 bg-gold/35'
  if (segment.status === 'DOWN') cls = 'h-[3px] self-center bg-accent/40 shadow-[inset_0_-1px_0_var(--color-canvas)]'
  if (isNow) cls += ' bg-gold-bright'
  return (
    <li
      className={`min-w-0 flex-1 rounded-[1px] ${cls}`}
      title={title}
      aria-label={title}
    />
  )
}

function IncenseUptime({
  segments = [],
  uptimePercent = 0,
  uptimeLabel = 'últimos 90 días',
  rodLabel = 'últimas muestras del monitor',
}) {
  const downs = segments.filter((s) => s.status === 'DOWN').length
  return (
    <section
      className="rounded-lg border border-border bg-bg/60 p-5"
      aria-label={`Uptime ${uptimeLabel}: ${formatPct(uptimePercent)} por ciento`}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="font-mono leading-none tabular-nums">
          <span className="text-6xl font-black text-gold sm:text-7xl">
            {formatPct(uptimePercent)}
          </span>
          <span className="ml-1 text-xl font-black text-gold/60">%</span>
        </p>
        <div className="pb-1 text-right">
          <p className="text-[12px] font-black text-fg-muted">uptime · {uptimeLabel}</p>
          <p className="mt-0.5 font-mono text-[11px] text-fg-muted">
            {downs === 0
              ? 'vara intacta — sin caídas'
              : `${downs} ${downs === 1 ? 'muestra carbonizada' : 'muestras carbonizadas'}`}
          </p>
        </div>
      </div>

      {/* La vara: flex con gap de 1px — cada hueco entre muestras es parte del trazo. */}
      <div className="mt-5 flex items-center gap-2.5">
        <ol className="flex min-w-0 flex-1 items-center gap-px" role="list">
          {segments.map((segment, i) => (
            <IncenseSegment
              key={segment.date ?? i}
              segment={segment}
              isNow={i === segments.length - 1}
            />
          ))}
        </ol>
        {/* La brasa de ahora: halo por sombra teñible, nada de blur. */}
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-hanko shadow-aura-sm [--aura-color:var(--color-hanko)]"
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-fg-muted">
        <span>{rodLabel}</span>
        <span>ahora</span>
      </div>
    </section>
  )
}

export default IncenseUptime
