import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Check, Mail } from 'lucide-react'
import { ApiError, endpoints } from '../lib/api'

/**
 * Form de suscripción a newsletter en el footer.
 *
 * Tras submit muestra estado de éxito inline (en lugar de toast) porque
 * vive en el footer y el toast podría perderse fuera del viewport.
 */
function NewsletterForm() {
  const { t } = useTranslation()
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
      setExito({ mensaje: res?.message ?? t('newsletter.okDefault') })
      reset()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : t('newsletter.errorEnvio')
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
            {t('newsletter.reintentar')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full min-w-0 flex-col gap-2"
    >
      <p className="text-[12px] text-fg-muted">{t('newsletter.intro')}</p>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <input
          type="email"
          autoComplete="email"
          placeholder={t('newsletter.emailPlaceholder')}
          {...register('email', {
            required: t('newsletter.errorRequired'),
            pattern: {
              value: /^\S+@\S+\.\S+$/,
              message: t('newsletter.errorInvalido'),
            },
          })}
          className={`w-full min-w-0 rounded-lg border bg-bg px-3 py-2 text-[13px] text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
            errors.email ? 'border-red-500' : 'border-border'
          }`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mail className="h-3.5 w-3.5" />
          {isSubmitting ? t('newsletter.enviando') : t('newsletter.submit')}
        </button>
      </div>
      {errors.email && (
        <p className="text-[11px] text-red-400">{errors.email.message}</p>
      )}
      <p className="text-[10px] text-fg-muted">{t('newsletter.doubleOptIn')}</p>
    </form>
  )
}

export default NewsletterForm
