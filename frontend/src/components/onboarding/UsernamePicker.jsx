import { useMemo, useState } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { generarSugerenciasUsername } from '../../lib/username-suggestions'
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability'

/**
 * V-8: campo de username con sugerencias de anime + disponibilidad en vivo.
 * Reutilizable en el OnboardingModal (paso 1) y en Ajustes.
 *
 * Props:
 *   - currentUsername: username actual (para "es el tuyo" + base de sugerencias)
 *   - onSubmit(username): async; el caller hace el cambio real (changeUsername)
 *       y muestra el toast de éxito. Si rechaza con ApiError 409 lo mostramos
 *       inline aquí.
 *   - submitLabel: texto del botón (default "Guardar username")
 *   - autoFocus
 */
function UsernamePicker({
  currentUsername = '',
  onSubmit,
  submitLabel = 'Guardar username',
  autoFocus = false,
}) {
  const [value, setValue] = useState(currentUsername)
  const [submitting, setSubmitting] = useState(false)
  const [errorInline, setErrorInline] = useState(null)
  const { status, puedeEnviar, trimmed } = useUsernameAvailability(
    value,
    currentUsername,
  )

  const sugerencias = useMemo(
    () => generarSugerenciasUsername(currentUsername),
    [currentUsername],
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!puedeEnviar || submitting) return
    setErrorInline(null)
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
    } catch (err) {
      // 409: el username se ocupó entre el debounce y el submit (carrera).
      setErrorInline(
        err instanceof ApiError && err.status === 409
          ? 'Ese username ya está en uso. Prueba con otro.'
          : err instanceof ApiError
            ? err.message || `Error ${err.status}`
            : 'No se pudo guardar. Inténtalo de nuevo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="onboarding-username"
          className="text-[12px] font-medium text-fg-strong"
        >
          Tu nombre de guerrero
        </label>
        <div className="relative">
          <input
            id="onboarding-username"
            type="text"
            value={value}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={30}
            onChange={(e) => {
              setErrorInline(null)
              setValue(e.target.value)
            }}
            placeholder="ShadowHokage"
            aria-invalid={Boolean(errorInline) || status === 'taken' || status === 'invalid'}
            aria-describedby="onboarding-username-status"
            className={`w-full rounded-lg border bg-bg px-3.5 py-2.5 pr-10 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold ${
              errorInline || status === 'taken' || status === 'invalid'
                ? 'border-danger'
                : status === 'available'
                  ? 'border-success/60'
                  : 'border-border'
            }`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {status === 'checking' && (
              <Loader2 className="h-4 w-4 animate-spin text-fg-muted" aria-hidden="true" />
            )}
            {status === 'available' && (
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
            )}
            {(status === 'taken' || status === 'invalid') && (
              <X className="h-4 w-4 text-danger" aria-hidden="true" />
            )}
          </span>
        </div>
        <StatusHint status={status} errorInline={errorInline} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
          <Sparkles className="h-3 w-3 text-gold" />
          Ideas con espíritu otaku
        </p>
        <div className="flex flex-wrap gap-2">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setErrorInline(null)
                setValue(s)
              }}
              className="rounded-full border border-border bg-surface-alt px-3 py-1.5 text-[12px] font-semibold text-fg-strong transition-colors hover:border-accent/50 hover:text-gold"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!puedeEnviar || submitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {submitting ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}

function StatusHint({ status, errorInline }) {
  const baseProps = {
    id: 'onboarding-username-status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  }

  if (errorInline) {
    return <p {...baseProps} className="text-[11px] text-danger">{errorInline}</p>
  }
  if (status === 'taken') {
    return (
      <p {...baseProps} className="text-[11px] text-danger">
        Ese username ya está cogido. Prueba otro o usa una sugerencia.
      </p>
    )
  }
  if (status === 'invalid') {
    return (
      <p {...baseProps} className="text-[11px] text-danger">
        Usa 3-30 caracteres: letras, números, guión y guión bajo.
      </p>
    )
  }
  if (status === 'available') {
    return <p {...baseProps} className="text-[11px] text-success">¡Disponible! Es todo tuyo.</p>
  }
  if (status === 'same') {
    return (
      <p {...baseProps} className="text-[11px] text-fg-muted">
        Es tu username actual. Puedes confirmarlo o elegir otro.
      </p>
    )
  }
  return (
    <p {...baseProps} className="text-[11px] text-fg-muted">
      Será tu identidad pública en /u/tu-username.
    </p>
  )
}

export default UsernamePicker
