import { Mail, ArrowUpRight } from 'lucide-react'
import { LEGAL_CONTACT_EMAIL, buildContactMailto } from '../data/legal'

const SUBJECT = 'AnimeShowdown — Sugerencia de personaje'
const BODY = `Hola,

Me gustaría que añadieran este personaje al catálogo de AnimeShowdown:

· Nombre:
· Anime:
· Por qué debería estar:

Gracias!`

const MAILTO = buildContactMailto({ subject: SUBJECT, body: BODY })

/**
 * CTA al final de /personajes y /animes para que el visitante sugiera un personaje
 * por email. mailto: pre-rellena asunto y cuerpo en su cliente de correo nativo.
 */
function SugerirPersonajeCTA({ titulo = '¿No está tu personaje favorito?' }) {
  return (
    <section className="mx-auto mt-16 max-w-3xl px-5 sm:px-0">
      {/* Card con hairline neutro y label inline; el oro vive en el texto. */}
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-9">
        <div className="flex flex-col gap-2 sm:max-w-md">
          <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-gold">
            <Mail className="h-3 w-3" />
            Catálogo abierto
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-fg-strong sm:text-3xl">
            {titulo}
          </h2>
          <p className="text-sm leading-relaxed text-fg-muted">
            Escríbenos a {LEGAL_CONTACT_EMAIL} con tu propuesta. Si tu
            sugerencia entra, te avisamos cuando esté en producción.
          </p>
        </div>
        <a
          href={MAILTO}
          className="group inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        >
          <Mail className="h-4 w-4" />
          Mandar correo
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>
    </section>
  )
}

export default SugerirPersonajeCTA
