// ============================================================================
// EmakiFinale.jsx — Sala FINAL. Todas las estadisticas vistas se COMPONEN en
// un rollo horizontal (emaki) compartible que se DESENROLLA 800ms al llegar
// (cover scaleX que retrae a la derecha, ease-brush) + playCampanilla. CTA de
// compartir y "volver a la arena". El rollo compone EXACTAMENTE lo visto: cada
// tile solo aparece si su sala existio.
//
// Esta pieza PINTA el DOM; el export de imagen lo hace el padre (identico al
// share-canvas del wrapped existente, wrapped-story-card). onCompartir() es
// del consumidor.
// ============================================================================

import { nfEs } from './sanctuary-core'

/**
 * Compone los tiles del emaki a partir del wrapped (solo lo que existe).
 * @param {object} w wrapped
 * @returns {Array<{kanji:string, valor:string, label:string, small:boolean}>}
 */
function componerTiles(w) {
  const tiles = []
  if ((w?.votosTotales ?? 0) > 0)
    tiles.push({ kanji: '票', valor: nfEs(w.votosTotales), label: 'votos emitidos', small: false })
  if (Array.isArray(w?.top3) && w.top3.length)
    tiles.push({ kanji: '推', valor: w.top3[0].nombre, label: 'tu fiel n.º 1', small: true })
  if ((w?.mejorRacha ?? 0) >= 1)
    tiles.push({ kanji: '灯', valor: nfEs(w.mejorRacha), label: 'mejor racha', small: false })
  if (w?.universoTop?.anime)
    tiles.push({ kanji: '界', valor: `${nfEs(w.universoTop.pct)}%`, label: w.universoTop.anime, small: true })
  return tiles
}

/**
 * @typedef {object} EmakiFinaleProps
 * @property {object} wrapped shape de /api/wrapped/me
 * @property {()=>void} [onCompartir] handler de compartir (lo cablea el padre)
 * @property {()=>void} [onVolver] handler de "volver a la arena"
 * @property {string} [feedback] mensaje de estado (aria-live) tras compartir
 * @property {boolean} [publico] estado opt-in del Wrapped (solo vista del dueño)
 * @property {()=>void} [onTogglePublico] alterna público/privado. Si no se pasa
 *   (vista pública de otro usuario), NO se muestra el toggle.
 */

/**
 * Rollo final compartible.
 * @param {EmakiFinaleProps} props
 */
function EmakiFinale({ wrapped, onCompartir, onVolver, feedback = '', publico = false, onTogglePublico }) {
  const tiles = componerTiles(wrapped)
  const alt =
    `Resumen de la temporada ${wrapped?.anio} de @${wrapped?.username}: ` +
    tiles.map((t) => `${t.label}, ${t.valor}`).join('; ') +
    '.'

  return (
    <>
      <p
        className="sanctuary-rise m-0 mb-[22px] text-balance text-[clamp(1.5rem,5vw,2.4rem)] font-extrabold text-fg-strong"
        style={{ '--pd': '0.1s' }}
      >
        Tu temporada {wrapped?.anio}, en un solo rollo
      </p>

      <div className="relative overflow-hidden rounded-2xl border border-border-gold-subtle shadow-elev-2">
        <div className="sanctuary-emaki-cover" />
        <div
          className="sanctuary-emaki-strip flex items-stretch overflow-x-auto bg-gradient-to-b from-surface-alt to-surface"
          role="group"
          aria-label="Resumen de tu temporada"
          tabIndex={0}
        >
          <div className="flex shrink-0 flex-col items-start justify-center gap-1.5 border-r border-border-gold-subtle bg-gradient-to-br from-accent/25 to-transparent px-[30px] py-7">
            <span lang="ja" className="font-kanji-serif text-3xl text-gold">
              結
            </span>
            <p className="m-0 mt-1.5 text-xl font-extrabold text-fg-strong">@{wrapped?.username}</p>
            <p className="m-0 font-mono text-xs text-fg-muted">AnimeShowdown Wrapped · {wrapped?.anio}</p>
          </div>
          {tiles.map((t, i) => (
            <div
              key={i}
              className="flex min-w-[170px] shrink-0 flex-col items-start justify-center gap-2 border-r border-white/[0.07] px-[30px] py-7"
            >
              <span aria-hidden="true" lang="ja" className="font-kanji-serif text-[22px] text-gold/70">
                {t.kanji}
              </span>
              <span
                className={`max-w-[12ch] font-extrabold leading-[1.05] text-gold-bright ${
                  t.small
                    ? 'text-[clamp(1.05rem,3vw,1.5rem)]'
                    : 'font-mono text-[clamp(2rem,5.5vw,3.2rem)] tabular-nums'
                }`}
              >
                {t.valor}
              </span>
              <span className="font-mono text-xs text-fg-muted">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="sanctuary-rise m-0 mt-3 font-mono text-xs text-fg-muted" style={{ '--pd': '0.2s' }}>
        desliza el rollo →
      </p>
      <span className="sr-only">{alt}</span>

      <div
        className="sanctuary-rise mt-6 flex flex-wrap justify-center gap-3"
        style={{ '--pd': '0.28s' }}
      >
        <button
          type="button"
          onClick={onCompartir}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-gold bg-gradient-to-b from-accent-hover to-accent px-[22px] text-[15px] font-bold text-fg-strong"
        >
          Compartir mi emaki
        </button>
        <button
          type="button"
          onClick={onVolver}
          className="as-button-ghost inline-flex min-h-11 items-center gap-2 rounded-lg px-[22px] text-[15px] font-semibold"
        >
          Volver a la arena
        </button>
        {onTogglePublico && (
          <button
            type="button"
            onClick={onTogglePublico}
            aria-pressed={publico}
            className="as-button-ghost inline-flex min-h-11 items-center gap-2 rounded-lg px-[22px] text-[15px] font-semibold"
          >
            {publico ? 'Wrapped público · sí' : 'Hacer mi Wrapped público'}
          </button>
        )}
      </div>
      {onTogglePublico && publico && wrapped?.username && (
        <p className="sanctuary-rise m-0 mt-3 text-[13px] text-fg-muted" style={{ '--pd': '0.32s' }}>
          Tu enlace:{' '}
          <span className="font-mono text-gold-bright">animeshowdown.dev/wrapped/{wrapped.username}</span>
        </p>
      )}
      <p role="status" aria-live="polite" className="m-0 mt-3 min-h-[18px] text-[13px] text-gold-bright">
        {feedback}
      </p>
    </>
  )
}

export default EmakiFinale
