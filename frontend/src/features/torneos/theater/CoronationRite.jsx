import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import KanjiStroke from '../../../components/KanjiStroke'
import { playSello, playCampanilla, playAcunado } from '../../../lib/sounds'

/**
 * CoronationRite — la CEREMONIA de coronación del campeón. Debe montarse
 * KEYED por slug del campeón:  <CoronationRite key={campeon.slug} ... />
 * → un re-render del padre NO repite la ceremonia (criterio nº3).
 *
 * Guion (timings): estandarte cae 550ms (ease-lift) → sello 王 ease-stamp
 * 380ms + sangrado → pan de oro 900ms (UNA pasada, 12 partículas transform-only)
 * → nombre del campeón trazado 800ms. Todos los @keyframes viven en theater.css;
 * el 王 se traza trazo a trazo con KanjiStroke (KanjiVG). Cero blur/SVG-filter.
 * prefers-reduced-motion: estado final directo (sin caída, sin pan de oro),
 * conservando el 100% de la información (nombre + sello + anime + aria-label).
 *
 * @param {object} props
 * @param {import('./theater-utils').Persona} props.campeon  {slug, nombre, anime}
 */
export default function CoronationRite({ campeon }) {
  const reduced = useReducedMotion() ?? false
  const [play, setPlay] = useState(false)

  // Coreografía como ESTADO PENDIENTE disparado en effect SOLO con timers
  // (setState dentro de callbacks de timer es legal; jamás síncrono en el
  // cuerpo del effect — lo exige react-hooks/set-state-in-effect del repo).
  useEffect(() => {
    if (reduced) {
      // Estado final directo, también vía timer (cero animación intermedia).
      const tr = setTimeout(() => setPlay(true), 0)
      return () => clearTimeout(tr)
    }
    const t0 = setTimeout(() => setPlay(true), 30)
    playCampanilla()
    const ts = [
      setTimeout(() => playSello(), 560),     // golpe del hanko 王
      setTimeout(() => playAcunado(), 1500),  // asentado final
    ]
    return () => { clearTimeout(t0); ts.forEach(clearTimeout) }
  }, [reduced])

  // 12 partículas de pan de oro DETERMINISTAS por índice (sin Math.random).
  const leaves = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const seed = (i * 2654435761) >>> 0
    const f = (n) => ((seed >> n) & 255) / 255
    return {
      left: 6 + (i / 11) * 88 + (f(3) - 0.5) * 6,
      gx: `${(f(5) - 0.5) * 26}vw`,
      gr: `${180 + Math.round(f(8) * 320)}deg`,
      gd: `${Math.round(560 + f(11) * 420)}ms`,
      gs: 0.7 + f(2) * 0.8,
    }
  }), [])

  return (
    <div role="region" aria-label={`Coronación de ${campeon.nombre}, campeón del torneo`}
      style={{ position: 'relative', overflow: 'hidden', padding: '20px 16px 30px', borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-gold)',
        background: 'radial-gradient(120% 90% at 50% -10%, color-mix(in srgb,var(--color-accent) 30%, transparent), transparent 60%), var(--color-bg)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {play && !reduced && leaves.map((l, i) => (
          <span key={i} className="teatro-panoro teatro-panoro--play"
            style={{ left: `${l.left}%`, '--gx': l.gx, '--gr': l.gr, '--gd': l.gd, '--gs': l.gs }} />
        ))}
      </div>

      <div className={play && !reduced ? 'teatro-estandarte teatro-estandarte--play' : 'teatro-estandarte'}
        style={{ width: 'min(360px, 86%)', margin: '0 auto', position: 'relative' }}>
        <div aria-hidden="true" style={{ height: 6, background: 'color-mix(in srgb,var(--color-gold) 40%, var(--color-canvas))', borderRadius: 3 }} />
        <div className="teatro-estandarte__tela" style={{ padding: '22px 18px 26px', textAlign: 'center', position: 'relative',
          clipPath: 'polygon(0 0, 100% 0, 100% 92%, 50% 100%, 0 92%)', border: '1px solid var(--color-border-gold-subtle)', borderTop: 'none' }}>
          <p className="font-mono" style={{ margin: 0, fontSize: 10.5, letterSpacing: 1, color: 'var(--color-gold-pale)' }}>CAMPEÓN · 番付 第一位</p>

          <div style={{ position: 'relative', width: 120, height: 120, margin: '10px auto 6px' }}>
            <span aria-hidden="true" className={play && !reduced ? 'teatro-sangrado teatro-sangrado--play' : ''}
              style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '3px solid color-mix(in srgb,var(--color-hanko) 70%,transparent)', '--teatro-sangrado-delay': '600ms', opacity: 0 }} />
            <span className={play && !reduced ? 'teatro-sello teatro-sello--play' : 'teatro-sello teatro-sello--set'}
              style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', '--teatro-sello-delay': '560ms', borderRadius: '50%',
                border: '4px solid color-mix(in srgb,var(--color-hanko) 80%,transparent)',
                background: 'radial-gradient(circle at 40% 32%, color-mix(in srgb,var(--color-hanko) 30%,transparent), transparent 70%)' }}>
              <KanjiStroke kanji="王" size={84} strokeMs={200} gapMs={150} strokeWidth={7}
                color="var(--color-gold-bright)" replayKey={campeon.slug} />
            </span>
          </div>

          {/* h2 (no h3): bajo el único h1 (proscenio) y sin h2 intermedio dentro
              del overlay, un h3 saltaría el orden de encabezados (WCAG 1.3.1). */}
          <h2 className={play && !reduced ? 'teatro-nombre teatro-nombre--play' : ''}
            style={{ margin: '6px 0 2px', fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900,
              color: 'var(--color-fg-strong)', '--teatro-nombre-delay': '900ms', lineHeight: 1.1 }}>
            {campeon.nombre}
          </h2>
          {campeon.anime && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-gold)' }}>{campeon.anime}</p>}
        </div>
      </div>
    </div>
  )
}
