import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Mail } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

/**
 * Política DMCA / takedown notice.
 *
 * <p>AnimeShowdown muestra imágenes de personajes de anime bajo fair
 * use educativo. Si un titular de derechos quiere que retiremos algo,
 * esta página explica cómo hacerlo. 24h de respuesta tras notice válido.
 */
function DmcaPage() {
  useSeo({
    title: 'Política DMCA / takedown',
    description:
      'Cómo notificar uso indebido de contenido protegido por copyright en AnimeShowdown. Retirada en 24h tras notice válido.',
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'DMCA', path: '/dmca' },
        ])}
      />
      <div className="mx-auto max-w-3xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <AlertTriangle className="h-3 w-3" />
            Legal
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Política DMCA
          </h1>
          <p className="max-w-2xl text-[13px] text-fg-muted">
            Última actualización: 16 mayo 2026.
          </p>
        </motion.header>

        <article className="flex flex-col gap-6 text-[14px] leading-relaxed text-fg-muted">
          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              Resumen
            </h2>
            <p>
              AnimeShowdown es un sitio educativo de portafolio que muestra
              personajes de anime bajo fair use comentario (Berne Convention
              art. 10) — descripciones originales en español + imágenes
              referenciales de los animes correspondientes para crítica y
              ranking comunitario.
            </p>
            <p className="mt-3">
              Si eres titular de derechos de copyright (studio, mangaka,
              editorial o representante autorizado) y crees que un contenido
              de AnimeShowdown infringe tus derechos, te retiraremos lo
              denunciado en menos de{' '}
              <strong className="text-fg-strong">24 horas</strong> tras
              recibir un notice válido.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              Cómo enviar un takedown notice
            </h2>
            <p className="mb-3">Email a:</p>
            <a
              href="mailto:diegogildam@gmail.com?subject=DMCA Takedown — AnimeShowdown"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <Mail className="h-3.5 w-3.5" />
              diegogildam@gmail.com
            </a>
            <p className="mt-3 mb-2">Incluye en el mensaje:</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>
                <strong className="text-fg-strong">Identificación del titular:</strong>{' '}
                tu nombre o el de la entidad que representas, dirección
                postal y email de contacto.
              </li>
              <li>
                <strong className="text-fg-strong">Obra protegida:</strong>{' '}
                qué personaje, anime o material de copyright protege tu
                reclamación.
              </li>
              <li>
                <strong className="text-fg-strong">URL exacta en AnimeShowdown:</strong>{' '}
                que apunte al contenido infractor (ej.{' '}
                <code className="text-fg-strong">/personajes/akame</code>).
              </li>
              <li>
                <strong className="text-fg-strong">Declaración de buena fe:</strong>{' '}
                que crees que el uso no está autorizado por el titular ni
                por la ley.
              </li>
              <li>
                <strong className="text-fg-strong">Declaración de exactitud:</strong>{' '}
                que la información del notice es correcta y, bajo perjurio,
                eres el titular o estás autorizado a actuar en su nombre.
              </li>
              <li>
                <strong className="text-fg-strong">Firma electrónica</strong>{' '}
                (escaneo o nombre completo al final del mensaje).
              </li>
            </ol>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              Plazo de respuesta
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-fg-strong">Acuse de recibo:</strong>{' '}
                en menos de 24 horas tras recibir el notice por email.
              </li>
              <li>
                <strong className="text-fg-strong">Retirada del contenido:</strong>{' '}
                en menos de 24 horas adicionales si el notice cumple los
                requisitos (total 48h).
              </li>
              <li>
                <strong className="text-fg-strong">Notificación al usuario:</strong>{' '}
                si el contenido era UGC (torneo creado por un user),
                informaremos al creador del torneo para que sepa por qué
                desapareció.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              Contranotice
            </h2>
            <p>
              Si crees que tu contenido fue retirado por error, puedes
              enviar contranotice al mismo email con:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>Identificación del contenido retirado y URL.</li>
              <li>Declaración bajo perjurio de que la retirada fue por error o identificación errónea.</li>
              <li>Aceptación de jurisdicción de los tribunales españoles.</li>
            </ul>
            <p className="mt-3">
              Reincorporaremos el contenido en 10-14 días salvo que el
              denunciante original inicie acciones legales formales.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              Reincidencia
            </h2>
            <p>
              Los usuarios con múltiples notices DMCA confirmados verán
              cerrada su cuenta sin reembolso y sin opción de crear cuenta
              nueva con el mismo email.
            </p>
          </section>
        </article>

        <div className="mt-10 flex flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link to="/privacidad" className="hover:text-gold hover:underline">
            Política de privacidad
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terminos" className="hover:text-gold hover:underline">
            Términos de uso
          </Link>
        </div>
      </div>
    </section>
  )
}

export default DmcaPage
