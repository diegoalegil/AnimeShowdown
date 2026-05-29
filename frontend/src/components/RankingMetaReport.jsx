import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import {
  useRankingSegmentado,
  useRankingMovimientos,
} from '../hooks/useRanking'

/**
 * "Meta Report" — sección narrativa al inicio de /ranking que cuenta
 * QUÉ está pasando en el ranking esta semana usando texto generado
 * desde los mismos endpoints que ya carga la página.
 *
 * <p>Añade narrativa breve: "Top 1 domina · X subieron, Y cayeron · vota
 * tú para mover el meta". Convierte una tabla en un reportaje.
 *
 * <p>Sin backend nuevo: usa useRankingSegmentado all-time (mismo
 * endpoint que ListaBackend "all") y useRankingMovimientos 7d (mismo
 * que MoversStrip). React Query deduplica las requests.
 *
 * <p>No renderiza nada si no hay datos suficientes para contar algo
 * útil (top vacío o cargando). Empty state amistoso si hay top pero
 * cero movimientos.
 */
function RankingMetaReport() {
  const { data: rankingTop } = useRankingSegmentado({ periodo: 'all', limit: 5 })
  const { data: movs } = useRankingMovimientos({ dias: 7, limit: 50 })

  const insight = useMemo(() => {
    if (!Array.isArray(rankingTop) || rankingTop.length === 0) return null
    const topPersonajes = rankingTop
      .map((item) => item?.personaje ?? item)
      .filter((personaje) => personaje?.slug && personaje?.nombre)
      .slice(0, 3)
    if (topPersonajes.length === 0) return null
    const [top1, top2, top3] = topPersonajes
    const conMov = Array.isArray(movs)
      ? movs.filter((m) => m.delta != null && m.delta !== 0)
      : []
    const ups = conMov.filter((m) => m.delta > 0)
    const downs = conMov.filter((m) => m.delta < 0)
    const topUp = ups.length > 0
      ? ups.reduce((acc, m) => (Math.abs(m.delta) > Math.abs(acc.delta) ? m : acc))
      : null
    const topDown = downs.length > 0
      ? downs.reduce((acc, m) => (Math.abs(m.delta) > Math.abs(acc.delta) ? m : acc))
      : null
    return { top1, top2, top3, ups, downs, topUp, topDown }
  }, [rankingTop, movs])

  if (!insight) return null

  const { top1, top2, top3, ups, downs, topUp, topDown } = insight

  return (
    <section
      aria-label="Meta report"
      className="mt-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent p-5 sm:p-6"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-gold">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-gold">
          Meta report · esta semana
        </h2>
      </div>
      <div className="flex flex-col gap-2 text-[14px] leading-relaxed text-fg">
        <p>
          Lidera{' '}
          <ProperLink to={`/personajes/${top1.slug}`}>{top1.nombre}</ProperLink>
          <span className="text-fg-muted"> ({top1.anime})</span>
          {top2 && (
            <>
              , seguido de{' '}
              <ProperLink to={`/personajes/${top2.slug}`}>
                {top2.nombre}
              </ProperLink>
              {top3 && (
                <>
                  {' y '}
                  <ProperLink to={`/personajes/${top3.slug}`}>
                    {top3.nombre}
                  </ProperLink>
                </>
              )}
            </>
          )}
          .
        </p>
        {ups.length === 0 && downs.length === 0 ? (
          <p className="text-fg-muted">
            La tabla está tranquila estos 7 días — el podio mantiene sus puestos.
            Tu voto puede romper la calma.
          </p>
        ) : (
          <p>
            <span className="text-fg-muted">Últimos 7 días: </span>
            {ups.length > 0 && (
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {ups.length} {ups.length === 1 ? 'subida' : 'subidas'}
                </span>
                {topUp && (
                  <>
                    <span className="text-fg-muted"> · destaca </span>
                    <ProperLink to={`/personajes/${topUp.slug}`}>
                      {topUp.nombre}
                    </ProperLink>
                    <span className="font-mono font-bold text-success">
                      {' '}
                      +{Math.abs(topUp.delta)}
                    </span>
                  </>
                )}
                .
              </>
            )}
            {downs.length > 0 && (
              <>
                {' '}
                <span className="inline-flex items-center gap-1 font-semibold text-danger">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {downs.length} {downs.length === 1 ? 'caída' : 'caídas'}
                </span>
                {topDown && (
                  <>
                    <span className="text-fg-muted"> · cede </span>
                    <ProperLink to={`/personajes/${topDown.slug}`}>
                      {topDown.nombre}
                    </ProperLink>
                    <span className="font-mono font-bold text-danger">
                      {' '}
                      {topDown.delta}
                    </span>
                  </>
                )}
                .
              </>
            )}
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/votar"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold/20 px-3 py-1.5 text-[12px] font-semibold text-gold transition-colors hover:bg-gold/30"
        >
          Vota duelos abiertos
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          to="/metodologia-elo"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg/30 px-3 py-1.5 text-[12px] font-semibold text-fg-muted transition-colors hover:border-gold/50 hover:text-gold"
        >
          Cómo se calcula el ranking
        </Link>
      </div>
    </section>
  )
}

function ProperLink({ to, children }) {
  return (
    <Link
      to={to}
      className="font-semibold text-fg-strong underline-offset-2 hover:text-gold hover:underline"
    >
      {children}
    </Link>
  )
}

export default RankingMetaReport
