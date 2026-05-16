import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, Mail } from 'lucide-react'
import { ApiError, endpoints } from '../lib/api'

/**
 * Form de suscripción a newsletter en el footer (Plan v2 §4.8).
 *
 * Tras submit muestra estado de éxito inline (en lugar de toast) porque
 * vive en el footer y el toast podría perderse fuera del viewport.
 */
function NewsletterForm() {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()
  const [exito, setExito] = useState(null) // {mensaje} | null

  const onSubmit = async (data) => {
    try {
      const res = await endpoints.suscribirNewsletter(data.email.trim())
      setExito({ mensaje: res?.message ?? 'Te hemos enviado un email para confirmar.' })
      reset()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : 'No se pudo enviar. Inténtalo de nuevo en unos segundos.'
      setError('email', { message: msg })
    }
  }

  if (exito) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px] text-emerald-300">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{exito.mensaje}</p>
          <button
            type="button"
            onClick={() => setExito(null)}
            className="mt-1 text-[11px] text-emerald-200/70 hover:text-emerald-200"
          >
            Suscribir otro email
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
      <p className="text-[12px] text-fg-muted">
        Resumen semanal con el top, torneos nuevos y predicciones destacadas.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          {...register('email', {
            required: 'Introduce tu email',
            pattern: {
              value: /^\S+@\S+\.\S+$/,
              message: 'Email no válido',
            },
          })}
          className={`flex-1 rounded-lg border bg-bg px-3 py-2 text-[13px] text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
            errors.email ? 'border-red-500' : 'border-border'
          }`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mail className="h-3.5 w-3.5" />
          {isSubmitting ? 'Enviando…' : 'Suscribirme'}
        </button>
      </div>
      {errors.email && (
        <p className="text-[11px] text-red-400">{errors.email.message}</p>
      )}
      <p className="text-[10px] text-fg-muted">
        Double opt-in: necesitas confirmar via email. Puedes darte de baja
        en cualquier momento desde el footer de cada envío.
      </p>
    </form>
  )
}

export default NewsletterForm
