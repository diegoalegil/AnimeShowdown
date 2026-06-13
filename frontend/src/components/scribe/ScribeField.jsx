import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import './scribe-kit.css'

// field-sizing: content (Chrome 123+). Safari/Firefox caen al fallback de
// medición por scrollHeight (sin animar height — escritura directa en ref).
const SUPPORTS_FIELD_SIZING =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content')

/**
 * ScribeField — campo de texto del kit del escriba (input / password / textarea).
 *
 * <p>Controlado y compatible con los formularios actuales: `value` / `onChange`
 * (evento nativo) / `error`. El componente NO valida: el padre decide al blur
 * o al submit y pasa `error`. Todo el ornamento (trazo de tinta, label
 * flotante, autofill) es CSS puro (scribe-kit.css) — el componente está
 * memoizado y un keystroke solo re-renderiza este campo, no el form entero.
 * Para react-hook-form existe el puente {@link ScribeFieldRhf}.
 *
 * <p>Coreografía (ver scribe-kit.css): subrayado scaleX origin-left 220ms
 * var(--ease-brush) carmesí→oro; label mono translateY+scale(0.85) 150ms;
 * error: sangrado carmesí + tremor de 2px 150ms UNA vez por validación
 * (re-montado por key); corregido: check de un trazo 250ms que se desvanece
 * a los 2s; Bloq Mayús solo en password.
 *
 * <p>Autofill: la label flota vía CSS (:-webkit-autofill / :autofill), así el
 * texto autocompletado nunca se pisa aunque React no haya visto el evento.
 * Requiere `placeholder=" "` (lo pone el componente) para :placeholder-shown.
 *
 * @param {object} props
 * @param {string} props.label             Texto de la label (SIEMPRE asociada vía htmlFor)
 * @param {string} props.value             Valor controlado
 * @param {(e: import('react').ChangeEvent) => void} props.onChange  Evento nativo, como los inputs actuales
 * @param {string|null} [props.error]      Mensaje de error o null. El padre valida (blur/submit, nunca por keystroke)
 * @param {'text'|'password'|'email'|'url'|'search'|'tel'} [props.type='text']
 * @param {boolean} [props.multiline=false]  textarea que crece (field-sizing o medición; jamás anima height)
 * @param {number}  [props.rows=3]
 * @param {number}  [props.maxLength]
 * @param {boolean} [props.showCount=false]  contador mono: ámbar al 90% del límite, carmesí al 100%
 * @param {boolean} [props.disabled=false]   tinta seca: hairline punteada, ornamento apagado, texto AA
 * @param {boolean} [props.readOnly=false]    el focus traza en oro (consultable, no editable)
 * @param {boolean} [props.required=false]
 * @param {string}  [props.autoComplete]    pásalo SIEMPRE en campos autofillables (email, name, new-password…)
 * @param {string}  [props.name]
 * @param {string}  [props.id]              por defecto useId()
 * @param {string}  [props.hint]            texto fijo bajo el campo (columna izquierda del meta)
 * @param {(e: import('react').FocusEvent) => void} [props.onBlur]  punto natural para validar
 * @param {import('react').Ref<HTMLElement>} [props.ref]  ref al control nativo (React 19: prop normal) —
 *                                         lo usa react-hook-form para enfocar el primer campo inválido
 * @param {string}  [props.className]
 */
const ScribeField = memo(function ScribeField({
  label,
  value,
  onChange,
  error = null,
  type = 'text',
  multiline = false,
  rows = 3,
  maxLength,
  showCount = false,
  disabled = false,
  readOnly = false,
  required = false,
  autoComplete,
  name,
  id: idProp,
  hint,
  onBlur,
  ref = null,
  className = '',
}) {
  const autoId = useId()
  const id = idProp ?? `scribe-${autoId}`
  const msgId = `${id}-msg`
  const inputRef = useRef(null)
  // Ref combinada: la interna (autofill/autosize/caps) + la externa (RHF
  // enfoca el primer campo inválido). Sin return: un callback-ref que
  // devuelve función sería tratado como cleanup por React 19.
  const setControlRef = useCallback((el) => {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }, [ref])

  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  // "Corregido": flanco error→null. Patrón "derive state during render"
  // (React-Compiler-safe: setState condicionado a cambio de prop, sin effects).
  const [prevError, setPrevError] = useState(error)
  const [corrected, setCorrected] = useState(false)
  const [tremorKey, setTremorKey] = useState(0)
  if (prevError !== error) {
    setPrevError(error)
    if (prevError && !error) setCorrected(true)
    if (error) {
      setCorrected(false)
      setTremorKey((k) => k + 1)
    }
  }
  // El check se desvanece a los 2s (CSS) y se desmonta a los 2.4s (JS).
  useEffect(() => {
    if (!corrected) return undefined
    const t = setTimeout(() => setCorrected(false), 2400)
    return () => clearTimeout(t)
  }, [corrected])

  // Hook de autofill: data-attr informativo. El float de la label NO depende
  // de esto (es CSS); el flag sirve para telemetría/estilos extra si hicieran falta.
  const [autofilled, setAutofilled] = useState(false)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return undefined
    const onAnim = (e) => {
      if (e.animationName === 'scribe-autofill-start') setAutofilled(true)
      if (e.animationName === 'scribe-autofill-cancel') setAutofilled(false)
    }
    el.addEventListener('animationstart', onAnim)
    return () => el.removeEventListener('animationstart', onAnim)
  }, [])

  // Fallback de autosize del textarea (escritura directa, cero animación).
  useEffect(() => {
    if (!multiline || SUPPORTS_FIELD_SIZING) return
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [multiline, value])

  // Bloq Mayús: solo password, solo con foco; se limpia al blur.
  const syncCaps = (e) => {
    if (!isPassword) return
    const on = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock')
    setCapsOn((prev) => (prev === on ? prev : on))
  }

  const Tag = multiline ? 'textarea' : 'input'
  const shownType = isPassword ? (revealed ? 'text' : 'password') : type
  const len = typeof value === 'string' ? value.length : 0
  const countState = !maxLength ? '' : len >= maxLength ? 'is-max' : len >= Math.ceil(maxLength * 0.9) ? 'is-warn' : ''

  const wrapClass = [
    'scribe-field',
    error ? 'is-error' : '',
    corrected ? 'is-ok' : '',
    disabled ? 'is-disabled' : '',
    readOnly ? 'is-readonly' : '',
    isPassword ? 'has-eye' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapClass}>
      <div className="scribe-well">
        <Tag
          ref={setControlRef}
          id={id}
          className={multiline ? 'scribe-control scribe-area' : 'scribe-control'}
          type={multiline ? undefined : shownType}
          rows={multiline ? rows : undefined}
          placeholder=" "
          value={value}
          onChange={onChange}
          onBlur={(e) => {
            setCapsOn(false)
            onBlur?.(e)
          }}
          onKeyDown={syncCaps}
          onKeyUp={syncCaps}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          name={name}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || (isPassword && capsOn) || hint ? msgId : undefined}
          data-autofilled={autofilled || undefined}
        />
        <label className="scribe-label" htmlFor={id}>
          {label}
        </label>
        <span className="scribe-hairline" aria-hidden="true" />
        <span className="scribe-ink" aria-hidden="true" />
        {isPassword ? (
          <button
            type="button"
            className="scribe-eye"
            aria-pressed={revealed}
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setRevealed((r) => !r)}
            disabled={disabled}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path className="scribe-eye-lid" d="M2 12 C6 6.5, 18 6.5, 22 12 C18 17.5, 6 17.5, 2 12 Z" />
              <circle className="scribe-eye-pupil" cx="12" cy="12" r="3" />
            </svg>
          </button>
        ) : null}
        {corrected ? (
          <svg className="scribe-check" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9.5 L7.2 13.5 L15 4.5" pathLength="1" />
          </svg>
        ) : null}
      </div>
      <div className="scribe-meta">
        <div className="scribe-live" id={msgId} aria-live="polite">
          {error ? (
            // key = tremorKey → re-montado del <p> → el tremor corre UNA vez por validación.
            <p key={tremorKey} className="scribe-msg">
              {error}
            </p>
          ) : null}
          {isPassword && capsOn ? <p className="scribe-caps">Bloq Mayús activado</p> : null}
          {!error && !capsOn && hint ? <p className="scribe-hint">{hint}</p> : null}
        </div>
        {maxLength && showCount ? (
          <span className={`scribe-count ${countState}`} aria-hidden="true">
            {len} / {maxLength}
          </span>
        ) : null}
      </div>
    </div>
  )
})

export default ScribeField
