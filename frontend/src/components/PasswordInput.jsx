import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Input de contraseña con toggle de visibilidad (eye / eye-off). Compatible
 * con react-hook-form vía forwardRef — el `{...register('password', {...})}`
 * lo trata como un `<input>` normal porque expone los props y la ref hacia
 * el input interno.
 *
 * Aplicado en Login/Register/Reset (audit 2026-05-17). Antes los users no
 * tenían forma de verificar lo que escribían — anti-UX en passwords largas
 * o pegadas desde gestor.
 */
const PasswordInput = forwardRef(function PasswordInput(
  { className = '', error = false, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        {...rest}
        className={`w-full rounded-lg border bg-bg py-2.5 pl-3.5 pr-10 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          error ? 'border-red-500' : 'border-border'
        } ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-fg-muted transition-colors hover:text-fg-strong"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
})

export default PasswordInput
