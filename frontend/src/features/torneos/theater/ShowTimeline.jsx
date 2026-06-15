import { useEffect, useState } from 'react'
import { valueTextPaso } from './theater-utils'

/**
 * ShowTimeline — el control de la FUNCIÓN: scrubber (slider NATIVO) +
 * play/pausa + velocidad 0.5×/1×/2× + narrador aria-live (UNA frase por paso).
 *
 * El slider es un <input type="range"> nativo con aria-valuetext
 * ("paso 3 de 7: Goku elimina a Vegeta") → navegable por teclado de serie.
 * El narrador es una región aria-live=polite con una sola frase por paso.
 * Arrastrar el scrubber salta a cualquier paso SIN animaciones intermedias:
 * el padre deriva el estado del valor, no lo acumula.
 *
 * @param {object} props
 * @param {{steps:Array,totalSteps:number}} props.guion  compileScript(rounds)
 * @param {number}  props.step
 * @param {boolean} props.playing
 * @param {0.5|1|2} props.speed
 * @param {string}  props.narrator   frase del paso actual (una por paso)
 * @param {(step:number)=>void} props.onStep   arrastre del scrubber (pausa + salto directo)
 * @param {(playing:boolean)=>void} props.onPlay
 * @param {(speed:number)=>void} props.onSpeed
 */
export default function ShowTimeline({ guion, step, playing, speed, narrator, onStep, onPlay, onSpeed }) {
  const total = guion.totalSteps
  // El narrador aria-live debe MUTAR estando ya presente para que las AT lo
  // anuncien: si la región y su primer texto entran en el mismo commit (al abrir
  // la función) NVDA/VoiceOver no lo leen. Montamos la región vacía y reflejamos
  // `narrator` un tick después (setState en callback de timer, nunca síncrono).
  const [spoken, setSpoken] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setSpoken(narrator), 0)
    return () => clearTimeout(id)
  }, [narrator])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-card)',
      border: '1px solid var(--color-border-gold-subtle)',
      background: 'linear-gradient(180deg, color-mix(in srgb,var(--color-gold) 6%, var(--color-surface)), var(--color-surface))',
      boxShadow: 'var(--shadow-elev-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onPlay(!playing)} style={primaryBtn}
          aria-label={playing ? 'Pausar la función' : 'Reproducir la función'}>
          <span aria-hidden="true" style={{ fontSize: 14 }}>{playing ? '❚❚' : '▶'}</span>
          {playing ? 'Pausa' : step >= total ? 'Repetir' : 'Reproducir'}
        </button>

        <div role="group" aria-label="Velocidad de reproducción"
          style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-pill)', background: 'var(--color-surface-alt)', border: '1px solid color-mix(in srgb,var(--color-fg) 12%,transparent)' }}>
          {[0.5, 1, 2].map((s) => (
            <button key={s} type="button" onClick={() => onSpeed(s)} aria-pressed={speed === s}
              style={{ minHeight: 30, padding: '0 11px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: speed === s ? 'var(--color-canvas)' : 'var(--color-fg-muted)',
                background: speed === s ? 'var(--color-gold-bright)' : 'transparent' }}>{s}×</button>
          ))}
        </div>

        <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
          paso {step} / {total}
        </span>
      </div>

      <input type="range" min={0} max={total} step={1} value={step}
        onChange={(e) => onStep(Number(e.target.value))}
        aria-label="Línea temporal de la función" aria-valuetext={valueTextPaso(step, guion)}
        className="teatro-scrub" style={{ width: '100%', '--scrub-pct': `${total ? (step / total) * 100 : 0}%` }} />

      <p aria-live="polite" style={{ margin: 0, minHeight: 20, fontSize: 13, color: 'var(--color-fg)' }}>
        <span lang="ja" aria-hidden="true" className="font-kanji-serif" style={{ color: 'var(--color-gold)', marginRight: 7 }}>決</span>
        {spoken}
      </p>
    </div>
  )
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 16px', borderRadius: 'var(--radius-lg)',
  cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--color-fg-strong)',
  border: '1px solid color-mix(in srgb,var(--color-gold) 28%,transparent)',
  background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb,var(--color-fg-strong) 18%,transparent), 0 0 30px -16px var(--color-accent)',
}
