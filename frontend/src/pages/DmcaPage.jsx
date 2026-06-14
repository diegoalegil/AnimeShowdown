import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import SealedDocument from '../components/SealedDocument'
import { DMCA_CONTACT_MAILTO, LEGAL_CONTACT_EMAIL } from '../data/legal'

/**
 * Política DMCA / takedown notice.
 *
 * <p>AnimeShowdown muestra imágenes de personajes de anime bajo fair use
 * educativo. Si un titular de derechos quiere que retiremos algo, esta página
 * explica cómo hacerlo. El texto vive intacto en `sections[].body`.
 */
const SECTIONS = [
  {
    id: 'resumen',
    title: 'Resumen',
    body: (
      <>
        <p>
          AnimeShowdown es un sitio educativo de portafolio que muestra personajes
          de anime bajo fair use comentario (Berne Convention art. 10) —
          descripciones originales en español + imágenes referenciales de los
          animes correspondientes para crítica y ranking comunitario.
        </p>
        <p className="mt-3">
          Si eres titular de derechos de copyright (studio, mangaka, editorial o
          representante autorizado) y crees que un contenido de AnimeShowdown
          infringe tus derechos, te retiraremos lo denunciado en menos de{' '}
          <strong className="text-fg-strong">24 horas</strong> tras recibir un
          notice válido.
        </p>
      </>
    ),
  },
  {
    id: 'takedown',
    title: 'Cómo enviar un takedown notice',
    body: (
      <>
        <p className="mb-3">Email a:</p>
        <a
          href={DMCA_CONTACT_MAILTO}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Mail className="h-3.5 w-3.5" />
          {LEGAL_CONTACT_EMAIL}
        </a>
        <p className="mt-3 mb-2">Incluye en el mensaje:</p>
        <ol className="list-inside list-decimal space-y-1">
          <li>
            <strong className="text-fg-strong">Identificación del titular:</strong>{' '}
            tu nombre o el de la entidad que representas, dirección postal y email
            de contacto.
          </li>
          <li>
            <strong className="text-fg-strong">Obra protegida:</strong> qué
            personaje, anime o material de copyright protege tu reclamación.
          </li>
          <li>
            <strong className="text-fg-strong">URL exacta en AnimeShowdown:</strong>{' '}
            que apunte al contenido infractor (ej.{' '}
            <code className="text-fg-strong">/personajes/akame</code>).
          </li>
          <li>
            <strong className="text-fg-strong">Declaración de buena fe:</strong>{' '}
            que crees que el uso no está autorizado por el titular ni por la ley.
          </li>
          <li>
            <strong className="text-fg-strong">Declaración de exactitud:</strong>{' '}
            que la información del notice es correcta y, bajo perjurio, eres el
            titular o estás autorizado a actuar en su nombre.
          </li>
          <li>
            <strong className="text-fg-strong">Firma electrónica</strong> (escaneo
            o nombre completo al final del mensaje).
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'plazo',
    title: 'Plazo de respuesta',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>
          <strong className="text-fg-strong">Acuse de recibo:</strong> en menos de
          24 horas tras recibir el notice por email.
        </li>
        <li>
          <strong className="text-fg-strong">Retirada del contenido:</strong> en
          menos de 24 horas adicionales si el notice cumple los requisitos (total
          48h).
        </li>
        <li>
          <strong className="text-fg-strong">Notificación al usuario:</strong> si
          el contenido era UGC (torneo creado por un user), informaremos al creador
          del torneo para que sepa por qué desapareció.
        </li>
      </ul>
    ),
  },
  {
    id: 'contranotice',
    title: 'Contranotice',
    body: (
      <>
        <p>
          Si crees que tu contenido fue retirado por error, puedes enviar
          contranotice al mismo email con:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>Identificación del contenido retirado y URL.</li>
          <li>Declaración bajo perjurio de que la retirada fue por error o identificación errónea.</li>
          <li>Aceptación de jurisdicción de los tribunales españoles.</li>
        </ul>
        <p className="mt-3">
          Reincorporaremos el contenido en 10-14 días salvo que el denunciante
          original inicie acciones legales formales.
        </p>
      </>
    ),
  },
  {
    id: 'reincidencia',
    title: 'Reincidencia',
    body: (
      <p>
        Los usuarios con múltiples notices DMCA confirmados verán cerrada su cuenta
        sin reembolso y sin opción de crear cuenta nueva con el mismo email.
      </p>
    ),
  },
]

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
      <div className="mx-auto max-w-5xl">
        <SealedDocument
          title="Política DMCA"
          docId="Expediente AS-LEG-03 · /dmca"
          lastRevision="16 de mayo de 2026"
          sections={SECTIONS}
        />

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap gap-3 text-[13px] text-fg-muted">
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
