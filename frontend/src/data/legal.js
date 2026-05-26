export const LEGAL_CONTACT_EMAIL = 'contacto@animeshowdown.dev'
export const LEGAL_CONTACT_MAILTO = `mailto:${LEGAL_CONTACT_EMAIL}`
export const DMCA_CONTACT_MAILTO = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(
  'DMCA Takedown — AnimeShowdown',
)}`

export const PRIVACY_PROVIDERS = [
  {
    name: 'Railway',
    description: 'hosting del backend Spring Boot y ejecución de la API.',
  },
  {
    name: 'Neon PostgreSQL',
    description: 'base de datos gestionada para cuentas, votos, rankings y torneos.',
  },
  {
    name: 'Cloudflare Pages',
    description: 'hosting estático del frontend y CDN global.',
  },
  {
    name: 'Cloudflare R2',
    description: 'almacenamiento y distribución de imágenes optimizadas del catálogo.',
  },
  {
    name: 'Resend',
    description: 'emails transaccionales como verificación, reset y newsletter.',
  },
  {
    name: 'Sentry',
    description:
      'errores, Web Vitals y replay solo en errores si el despliegue lo habilita; texto enmascarado y sin cookies por defecto.',
  },
  {
    name: 'Google / Discord OAuth',
    description: 'login social opcional únicamente cuando lo inicia el usuario.',
  },
  {
    name: 'Cloudflare Turnstile',
    description: 'verificación antifraude en votos invitados cuando el flujo lo requiere.',
  },
]

export function buildContactMailto({ subject, body } = {}) {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const query = params.toString()
  return `${LEGAL_CONTACT_MAILTO}${query ? `?${query}` : ''}`
}
