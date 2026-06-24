import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Input de contraseña con toggle de visibilidad (eye / eye-off). Compatible
 * con react-hook-form vía forwardRef — el `{...register('password', {...})}`
 * lo trata como un `<input>` normal porque expone los props y la ref hacia
 * el input interno.
 *
 * Aplicado en Login/Register/Reset. Permite verificar lo escrito antes de
 * enviar formularios con passwords largas o pegadas desde gestor.
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
        className={`w-full rounded-lg border bg-bg py-2.5 pl-3.5 pr-12 text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-gold ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        // antes tabIndex=-1 — keyboard-only users
        // no podian activarlo. La conveniencia de "no romper Tab" no
        // justifica bloquear el toggle. Ahora focusable; el orden es
        // input → toggle → siguiente field, que es razonable.
        className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg-strong focus:outline-none focus:ring-2 focus:ring-gold"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
})

export default PasswordInput
