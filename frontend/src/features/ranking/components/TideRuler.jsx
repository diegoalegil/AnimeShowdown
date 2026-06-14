import { useMemo } from 'react';
import { construirMareaHoraria } from './command-core';

/**
 * TideRuler — la regleta de mareas: barras finas por intervalo construidas
 * SOLO con las fechas reales del feed (ventana honesta). Si el feed cubre ≤1h
 * agrupa en tramos de 10 min y lo declara en la etiqueta; si cubre más, agrupa
 * por hora (máx 12 = últimas 12h). La hora/tramo actual late (capa pre-render
 * con cross-fade de opacity, pausable; ver command-room.css).
 *
 * Accesibilidad: el gráfico es decorativo (aria-hidden) pero los conteos viven
 * en una <table> sr-only con scope correcto — la AT recibe lo mismo que el ojo.
 *
 * El `now` se INYECTA desde el padre (que tiene el reloj): así este componente
 * no llama Date.now() en render (regla del React Compiler).
 *
 * @param {Object} props
 * @param {import('./command-core').Voto[]} props.votos  Feed real (/api/votos/recientes).
 * @param {number} props.now  Epoch ms del último tick del reloj del padre.
 * @returns {JSX.Element}
 */
export function TideRuler({ votos, now }) {
  const marea = useMemo(() => construirMareaHoraria(votos, { now }), [votos, now]);

  return (
    <figure className="m-0 rounded-lg border border-border bg-surface px-3.5 pb-3 pt-3.5">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="font-kanji-serif text-[15px] text-gold">
            票
          </span>
          <span className="text-[12.5px] font-semibold text-fg-strong">Regleta de mareas</span>
        </span>
        <span className="font-mono text-[11px] text-fg-muted">ventana: {marea.windowLabel}</span>
      </figcaption>

      {marea.empty ? (
        <div className="flex h-[74px] items-center justify-center text-[12px] italic text-fg-muted">
          Sin votos en la ventana — la marea está plana.
        </div>
      ) : (
        <div aria-hidden="true" className="flex h-[74px] items-end gap-1.5">
          {marea.buckets.map((b, i) => (
            <div
              key={b.start}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="acr-bar relative w-full rounded-t-[2px]"
                  style={{
                    '--acr-stagger': `${i * 30}ms`,
                    height: `${Math.round(b.ratio * 100)}%`,
                    minHeight: 3,
                    background: b.actual
                      ? 'linear-gradient(180deg, var(--color-gold-bright), var(--color-gold))'
                      : 'color-mix(in srgb, var(--color-accent) 55%, var(--color-surface-alt))',
                  }}
                >
                  {b.actual && <span className="acr-bar-pulse" />}
                </div>
              </div>
              <span
                className="whitespace-nowrap font-mono text-[9px]"
                style={{ color: b.actual ? 'var(--color-gold-pale)' : 'var(--color-fg-muted)' }}
              >
                {b.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Espejo textual para AT: mismos conteos que el gráfico. */}
      <table className="sr-only">
        <caption>Votos por intervalo en la ventana mostrada ({marea.windowLabel})</caption>
        <thead>
          <tr>
            <th scope="col">Intervalo</th>
            <th scope="col">Votos</th>
          </tr>
        </thead>
        <tbody>
          {marea.buckets.map((b) => (
            <tr key={b.start}>
              <th scope="row">
                {b.label}
                {b.actual ? ' (actual)' : ''}
              </th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
