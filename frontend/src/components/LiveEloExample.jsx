/**
 * LiveEloExample.jsx — «El ejemplo vivo» del tratado del ELO.
 *
 * Dos sliders (ELO A, ELO B) mueven en vivo la expectativa y el
 * reparto de puntos. Puro estado local: cero red, cero timers.
 * Respuesta inmediata (sin debounce); la barra desliza con
 * transform 150ms y las cifras ruedan con el odómetro (180ms).
 *
 * HONESTIDAD: el ejemplo es ILUSTRATIVO. Calcula la matemática ELO
 * estándar descrita en §02–§03 (eloMath.js) con un factor K de
 * demostración que llega por prop kFactor; el valor K real del producto
 * vive en el backend y no se duplica aquí.
 *
 * INTEGRACIÓN: RollingNumber (abajo) es un odómetro local autocontenido.
 * El LiveNumber canónico del repo (features/ranking) anima por rAF un
 * cambio de valor en caliente; aquí la respuesta es por carrete CSS al
 * arrastrar el slider, así que el odómetro vive co-localizado.
 */
import { useState, useId } from 'react'
import { eloExpectation, eloDelta } from './eloMath'
import './elo-treatise.css'

/* ── utilidades puras ─────────────────────────────────────────── */

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Formato es-ES sin Intl (coma decimal). */
function formatEs(value, decimals) {
  return value.toFixed(decimals).replace('.', ',')
}

/* ── RollingNumber: odómetro local (solo transform) ───────────── */

/**
 * Odómetro font-mono: cada dígito es un carrete que se desplaza con
 * translateY (solo transform; transición en CSS, 180ms var(--ease-lift);
 * reduced-motion ⇒ cifra directa). Sin estado, sin refs: puro render.
 *
 * @param {object} props
 * @param {number} props.value — valor a mostrar (se usa |valor|)
 * @param {number} [props.decimals=0] — decimales fijos
 * @param {number} [props.pad=0] — mínimo de cifras enteras (relleno con
 *   espacio de cifra U+2007 para que el ancho no salte)
 * @param {string|null} [props.sign=null] — signo a anteponer ('+' | '−')
 * @param {string} [props.suffix=''] — sufijo estático (p. ej. ' %')
 * @param {string} [props.className]
 */
export function RollingNumber({ value, decimals = 0, pad = 0, sign = null, suffix = '', className = '' }) {
  const abs = Math.abs(value)
  let txt = formatEs(abs, decimals)
  const intLen = txt.split(',')[0].length
  if (pad > intLen) txt = '\u2007'.repeat(pad - intLen) + txt
  const label = (sign || '') + txt.replace(/\u2007/g, '') + suffix
  return (
    <span className={('et-ln ' + className).trim()} aria-label={label} role="img">
      <span className="et-ln-row" aria-hidden="true">
        {sign ? <span className="et-ln-char">{sign}</span> : null}
        {txt.split('').map((ch, i) =>
          /[0-9]/.test(ch) ? (
            <span key={'d' + (txt.length - i)} className="et-ln-digit">
              <span className="et-ln-reel" style={{ transform: 'translateY(' + -Number(ch) + 'em)' }}>
                {DIGITS.map((d) => <span key={d} className="et-ln-cell">{d}</span>)}
              </span>
            </span>
          ) : (
            <span key={'c' + (txt.length - i)} className="et-ln-char">{ch}</span>
          ),
        )}
        {suffix ? <span className="et-ln-char">{suffix}</span> : null}
      </span>
    </span>
  )
}

/* ── Slider accesible (label + valuetext, hit 44px) ───────────── */

/**
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label — texto visible del <label>
 * @param {number} props.value
 * @param {number} props.min / props.max / props.step
 * @param {string} props.expectationPct — pct ya formateado (valuetext)
 * @param {(v: number) => void} props.onChange
 */
function EloSlider({ id, label, value, min, max, step, expectationPct, onChange }) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className="et-sliderblock">
      <div className="et-sliderhead">
        <label htmlFor={id} className="et-sliderlabel">{label}</label>
        <RollingNumber value={value} pad={4} className="et-rating" />
      </div>
      <input
        id={id}
        className="et-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={value + ' puntos ELO, expectativa ' + expectationPct + ' %'}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--et-fill': fill + '%' }}
      />
    </div>
  )
}

/* ── El ejemplo vivo ──────────────────────────────────────────── */

/**
 * @param {object} props
 * @param {number} props.kFactor — REQUERIDO. Factor K de la demostración.
 *   El valor K real del producto vive en el backend: este es ilustrativo.
 * @param {number} [props.initialA=1500] — ELO inicial del personaje A.
 * @param {number} [props.initialB=1500] — ELO inicial del personaje B.
 * @param {number} [props.minRating=1000] — rango ilustrativo de la demo.
 * @param {number} [props.maxRating=3000] — rango ilustrativo de la demo.
 * @param {number} [props.step=25]
 */
export default function LiveEloExample({
  kFactor,
  initialA = 1500,
  initialB = 1500,
  minRating = 1000,
  maxRating = 3000,
  step = 25,
}) {
  const uid = useId()
  const [ratingA, setRatingA] = useState(initialA)
  const [ratingB, setRatingB] = useState(initialB)

  // Derivados puros del render — sin effects, sin refs (React Compiler ok).
  const expA = eloExpectation(ratingA, ratingB)
  const expB = 1 - expA
  const pctA = formatEs(expA * 100, 1)
  const pctB = formatEs(expB * 100, 1)
  const winA = eloDelta(kFactor, 1, expA) // ΔA si gana A (= −ΔB)
  const winB = eloDelta(kFactor, 1, expB) // ΔB si gana B (= −ΔA)

  return (
    <div className="et-live">
      <div
        className="et-live-duel"
        role="group"
        aria-label={'Duelo de ejemplo: personaje A con ' + ratingA + ' puntos contra personaje B con ' + ratingB + ' puntos'}
      >
        <EloSlider
          id={uid + '-a'} label="Personaje A" value={ratingA}
          min={minRating} max={maxRating} step={step}
          expectationPct={pctA} onChange={setRatingA}
        />
        <span className="et-live-vs" aria-hidden="true">対</span>
        <EloSlider
          id={uid + '-b'} label="Personaje B" value={ratingB}
          min={minRating} max={maxRating} step={step}
          expectationPct={pctB} onChange={setRatingB}
        />
      </div>

      <div className="et-expect">
        <span className="et-expect-title">expectativa de victoria</span>
        <div
          className="et-bar"
          role="img"
          aria-label={'Expectativa de victoria: personaje A ' + pctA + ' por ciento, personaje B ' + pctB + ' por ciento'}
        >
          <div className="et-bar-fill" style={{ transform: 'scaleX(' + expA + ')' }}></div>
          <div className="et-bar-mid"></div>
        </div>
        <div className="et-expect-labels" aria-hidden="true">
          <span className="et-expect-a">A <RollingNumber value={expA * 100} decimals={1} pad={3} suffix=" %" /></span>
          <span className="et-expect-b"><RollingNumber value={expB * 100} decimals={1} pad={3} suffix=" %" /> B</span>
        </div>
      </div>

      <div className="et-outcomes">
        <div className="et-outcomes-head">
          <span className="et-outcomes-title">Reparto de puntos tras el duelo</span>
          <span className="et-kchip">K = {kFactor}</span>
        </div>
        <table className="et-table">
          <thead>
            <tr>
              <th scope="col">resultado</th>
              <th scope="col">Δ personaje A</th>
              <th scope="col">Δ personaje B</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Si gana A</td>
              <td><RollingNumber className="et-delta-pos" value={winA} decimals={1} pad={2} sign="+" /></td>
              <td><RollingNumber className="et-delta-neg" value={winA} decimals={1} pad={2} sign="−" /></td>
            </tr>
            <tr>
              <td>Si gana B</td>
              <td><RollingNumber className="et-delta-neg" value={winB} decimals={1} pad={2} sign="−" /></td>
              <td><RollingNumber className="et-delta-pos" value={winB} decimals={1} pad={2} sign="+" /></td>
            </tr>
          </tbody>
        </table>
        <p className="et-kfoot">
          El factor <code>K</code> mostrado es un valor de <strong>demostración</strong> (prop <code>kFactor</code>):
          el valor real del producto vive en el backend y no se duplica en cliente. Cifras con un decimal,
          sin redondeo de producto. Esta calculadora es ilustrativa de la matemática descrita arriba.
        </p>
      </div>
    </div>
  )
}
