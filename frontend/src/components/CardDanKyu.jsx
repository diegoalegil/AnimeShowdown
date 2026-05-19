import { Award } from 'lucide-react'
import { usePerfilStats } from '../hooks/usePerfil'
import { calcularPuntos, rangoDe } from '../lib/danKyu'
import KanjiStroke from './KanjiStroke'

/**
 * Card del rango dan/kyū del usuario (Plan v2 §13.2). Muestra el rango
 * actual + progreso hasta el siguiente en barra horizontal. Calculado
 * client-side desde las stats del perfil (votos + predicciones + badges).
 *
 * <p>Sin props: usa el hook usePerfilStats. Con prop `data`: pinta
 * lo que le pasen — para mostrar el dan/kyū de otro usuario en
 * UsuarioPage.
 */
function CardDanKyu({ data: dataProp = null }) {
  const enabled = dataProp === null
  const { data: dataHook, isLoading: isLoadingHook } = usePerfilStats({
    enabled,
  })
  const stats = dataProp ?? dataHook
  const isLoading = dataProp === null && isLoadingHook

  if (!stats && !isLoading) return null

  const puntos = stats ? calcularPuntos(stats) : 0
  const { actual, siguiente, progreso } = rangoDe(puntos)

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Award className="h-4 w-4 text-amber-400" />
        <h2 className="text-lg font-bold text-fg-strong">Rango</h2>
      </div>
      <p className="mb-5 text-[12px] text-fg-muted">
        Sistema dan / kyū tradicional japonés. Sube de rango votando,
        prediciendo y desbloqueando logros.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <span
            className={`inline-flex items-center justify-center rounded-2xl border-2 px-4 py-2 ${
              actual.tipo === 'dan'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                : 'border-border bg-bg text-fg-muted'
            }`}
          >
            <span className="mr-2 inline-flex items-center gap-0.5">
              <KanjiStroke
                kanji={actual.kanji}
                size="1.5em"
                strokeMs={420}
                gapMs={90}
                strokeWidth={6}
                replayKey={actual.id}
              />
            </span>
            <span className="text-lg font-bold">{actual.nombre}</span>
          </span>
          <p className="text-[12px] text-fg-muted">
            <strong className="font-mono tabular-nums text-fg-strong">{puntos}</strong>{' '}
            puntos · {actual.tipo === 'dan' ? 'Maestro' : 'Estudiante'}
          </p>
          {siguiente ? (
            <div className="w-full">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-fg-muted">
                <span>{actual.nombre}</span>
                <span>{siguiente.nombre}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent via-fuchsia-400 to-amber-400 transition-all"
                  style={{ width: `${Math.round(progreso * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-fg-muted">
                Faltan{' '}
                <strong className="font-mono text-fg-strong">
                  {siguiente.umbral - puntos}
                </strong>{' '}
                puntos para {siguiente.nombre}
              </p>
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-amber-300">
              Rango máximo alcanzado · <span className="font-jp">九段</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default CardDanKyu
