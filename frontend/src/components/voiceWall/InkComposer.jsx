import { useState, useId } from 'react'

/**
 * EL PINCEL — formulario de escritura del Muro de Voces.
 *
 * Garantía dura (criterio 1): el texto NUNCA se pierde.
 * - El textarea solo se vacía cuando la promesa de `onSubmit` RESUELVE.
 * - Si rechaza, el texto sigue intacto y se muestra un error honesto.
 * - En el flujo optimista (muro principal) `onSubmit` resuelve al instante
 *   y el rescate tardío llega por la prop `restore`: si el campo está vacío
 *   se restaura directo; si el usuario ya escribió otra cosa, se ofrece un
 *   botón «Recuperar lo escrito» (no se machaca nada).
 *
 * @param {object} props
 * @param {(text: string) => Promise<unknown>} props.onSubmit — contrato:
 *   resolver = publicado (el campo se limpia); rechazar = fallo (el texto
 *   permanece). Para el flujo optimista, resolver inmediatamente.
 * @param {number} [props.maxLength] — límite REAL de la API de comentarios.
 *   No se inventa aquí: pásalo desde el contenedor (sin él no hay contador).
 * @param {{text: string, error: string, token: number}|null} [props.restore]
 *   — orden de restauración externa tras un fallo optimista. `token` debe
 *   cambiar en cada fallo (número creciente).
 * @param {string} [props.placeholder]
 * @param {string} [props.submitLabel]
 * @param {boolean} [props.compact] — variante para responder en hilo
 * @param {boolean} [props.autoFocus]
 * @param {boolean} [props.disabled]
 * @param {(el: HTMLElement|null) => void | {current: HTMLElement|null}} [props.paperRef]
 *   — ref al papel del composer (origen del vuelo FLIP del muro)
 */
export default function InkComposer({
  onSubmit,
  maxLength,
  restore = null,
  placeholder = 'Deja tu voz en el muro...',
  submitLabel = 'Dejar voz',
  compact = false,
  autoFocus = false,
  disabled = false,
  paperRef = null,
}) {
  const fieldId = useId()
  const errorId = fieldId + '-err'

  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [recoverable, setRecoverable] = useState(null)
  const [busy, setBusy] = useState(false)

  // Restauración externa: ajuste DURANTE el render con guard
  // (patrón canónico React 19 / Compiler — nada de setState en effects).
  const token = restore ? restore.token : null
  const [prevToken, setPrevToken] = useState(token)
  if (token !== prevToken) {
    setPrevToken(token)
    if (restore) {
      setError(restore.error)
      if (text.trim() === '') {
        setText(restore.text)
        setRecoverable(null)
      } else {
        // El usuario ya está escribiendo otra voz: no se machaca.
        setRecoverable(restore.text)
      }
    }
  }

  const len = text.length
  const ratio = maxLength ? len / maxLength : 0
  const ink = ratio >= 0.92 ? 'hot' : ratio >= 0.72 ? 'warm' : undefined
  const canSubmit = !disabled && !busy && text.trim().length > 0

  function submit() {
    if (!canSubmit) return
    const value = text.trim()
    setBusy(true)
    setError(null)
    Promise.resolve(onSubmit(value)).then(
      () => {
        setBusy(false)
        setText('')
        setRecoverable(null)
      },
      () => {
        // El texto sigue INTACTO en el estado: solo se informa.
        setBusy(false)
        setError('No se ha podido publicar. Tu texto sigue aquí: vuelve a intentarlo.')
      },
    )
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className={'vw-composer' + (compact ? ' vw-composer-compact' : '')}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="vw-sr" htmlFor={fieldId}>
        Escribe tu voz
      </label>
      <div className="vw-composer-paper" ref={paperRef || undefined}>
        <textarea
          id={fieldId}
          className="vw-input"
          value={text}
          maxLength={maxLength}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled || busy}
          rows={compact ? 2 : 3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        ></textarea>
        <span className="vw-hairline" aria-hidden="true"></span>
      </div>
      {error ? (
        <p className="vw-error" id={errorId} role="alert">
          <span>{error}</span>
          {recoverable ? (
            <button
              type="button"
              className="vw-recover"
              onClick={() => {
                setText(recoverable)
                setRecoverable(null)
                setError(null)
              }}
            >
              Recuperar lo escrito
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="vw-composer-foot">
        {maxLength ? (
          <span className="vw-counter" data-ink={ink} aria-hidden="true">
            {len}/{maxLength}
          </span>
        ) : null}
        <button type="submit" className="vw-submit" disabled={!canSubmit}>
          {busy ? 'Publicando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
