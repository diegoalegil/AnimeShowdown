import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Mail } from 'lucide-react'
import { ApiError, endpoints } from '../lib/api'

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/**
 * Form de suscripción a newsletter en el footer.
 *
 * Tras submit muestra estado de éxito inline (en lugar de toast) porque
 * vive en el footer y el toast podría perderse fuera del viewport.
 *
 * Validación nativa con useState en vez de react-hook-form: es un único campo
 * email y RHF (~7 KB gzip) viajaba en el bundle inicial de TODA la app por ser
 * el footer un import estático del shell. Mismo comportamiento, sin la dep.
 */
function NewsletterForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setErrorMsg] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [exito, setExito] = useState(null) // {mensaje} | null

  const onSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    const value = email.trim()
    if (!value) {
      setErrorMsg(t('newsletter.errorRequired'))
      return
    }
    if (!EMAIL_PATTERN.test(value)) {
      setErrorMsg(t('newsletter.errorInvalido'))
      return
    }
    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      const res = await endpoints.suscribirNewsletter(value)
      setExito({ mensaje: res?.message ?? t('newsletter.okDefault') })
      setEmail('')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || `Error ${err.status}`
          : t('newsletter.errorEnvio')
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (exito) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-[12px] text-success">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{exito.mensaje}</p>
          <button
            type="button"
            onClick={() => setExito(null)}
            className="mt-1 text-[11px] text-success/70 hover:text-success"
          >
            {t('newsletter.reintentar')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex w-full min-w-0 flex-col gap-2"
    >
      <p className="text-[12px] text-fg-muted">{t('newsletter.intro')}</p>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <input
          type="email"
          autoComplete="email"
          placeholder={t('newsletter.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          className={`w-full min-w-0 rounded-lg border bg-bg px-3 py-2 text-[13px] text-fg-strong placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40 ${
            error ? 'border-danger' : 'border-border'
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
      {error && (
        <p className="text-[11px] text-danger">{error}</p>
      )}
      <p className="text-[10px] text-fg-muted">{t('newsletter.doubleOptIn')}</p>
    </form>
  )
}

export default NewsletterForm
