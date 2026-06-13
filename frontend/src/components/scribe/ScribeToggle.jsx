import { memo, useId } from 'react'
import { useSound } from '../../contexts/SoundContext'
import './scribe-kit.css'

/**
 * ScribeToggle — interruptor lacado del kit del escriba.
 *
 * <p>Recorrido corto: el knob viaja translateX(16px) en 150ms var(--ease-lift);
 * el track pasa a laca carmesí con borde oro. El "clack" es Web Audio 100%
 * sintetizado (playClack en lib/sounds.js) y respeta el mute global vía
 * SoundContext.
 *
 * <p>A11y: <button role="switch"> nativo — Espacio/Enter alternan de serie,
 * aria-checked refleja el estado, la label está asociada con aria-labelledby
 * y el hit target efectivo es 44px (::after en CSS).
 *
 * @param {object} props
 * @param {boolean} props.checked
 * @param {(next: boolean) => void} props.onChange   recibe el siguiente valor (no el evento)
 * @param {string} props.label                       texto visible, asociado al switch
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.id]
 * @param {string} [props.className]                 clases del wrapper (layout)
 */
const ScribeToggle = memo(function ScribeToggle({
  checked,
  onChange,
  label,
  disabled = false,
  id: idProp,
  className = '',
}) {
  const autoId = useId()
  const id = idProp ?? `scribe-tog-${autoId}`
  const labelId = `${id}-label`
  const { play } = useSound()

  return (
    <div className={`flex min-h-11 items-center justify-between gap-4 ${className}`}>
      <span id={labelId} className="text-sm text-fg">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        id={id}
        className="scribe-toggle"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => {
          onChange(!checked)
          play('playClack')
        }}
      >
        <span className="scribe-knob" aria-hidden="true" />
      </button>
    </div>
  )
})

export default ScribeToggle
