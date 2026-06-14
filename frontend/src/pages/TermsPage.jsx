import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import SealedDocument from '../components/SealedDocument'

/**
 * Términos de uso. Marco legal mínimo para uso del servicio: aceptación,
 * conducta esperada, contenido de usuarios, propiedad intelectual. El texto
 * vive intacto en `sections[].body`; SealedDocument aporta el layout sellado.
 */
const SECTIONS = [
  {
    id: 'aceptacion',
    title: 'Aceptación',
    body: (
      <p>
        Al crear cuenta o usar AnimeShowdown aceptas estos términos. Si no estás
        de acuerdo, no uses el servicio. Tienes que ser mayor de 13 años (16 en
        algunos países europeos) para crear cuenta.
      </p>
    ),
  },
  {
    id: 'cuenta',
    title: 'Cuenta y seguridad',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>Eres responsable de la seguridad de tu contraseña.</li>
        <li>Activa 2FA si vas a usar la cuenta intensivamente.</li>
        <li>Una cuenta por persona — multicount para inflar votos rompe el ranking ELO.</li>
        <li>Username único, sin lenguaje ofensivo ni suplantación de marca.</li>
      </ul>
    ),
  },
  {
    id: 'conducta',
    title: 'Conducta',
    body: (
      <>
        <p className="mb-2">No permitido:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Spam, scraping masivo del endpoint público sin razón legítima.</li>
          <li>Manipulación del ranking ELO con bots o multicount.</li>
          <li>Crear torneos UGC con contenido ofensivo, ilegal o con copyright en el nombre/descripción.</li>
          <li>Acoso a otros usuarios via follows masivos o mensajes (cuando exista esa función).</li>
          <li>Intentos de explotación de la API o bypass de rate limit.</li>
        </ul>
        <p className="mt-3">
          Las cuentas que incurran en estas conductas se cerrarán sin previo aviso
          ni reembolso.
        </p>
      </>
    ),
  },
  {
    id: 'ugc',
    title: 'Contenido de usuarios (UGC)',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>
          Los <strong className="text-fg-strong">torneos que creas</strong>{' '}
          (nombre, descripción) son tuyos pero le otorgas a AnimeShowdown licencia
          no exclusiva mundial para mostrarlos y derivarlos en features (OG image,
          sitemap, search). Esa licencia termina si cierras tu cuenta.
        </li>
        <li>
          Tus <strong className="text-fg-strong">votos, predicciones, follows</strong>{' '}
          generan datos agregados (ranking ELO, leaderboards) que permanecen en el
          sistema incluso si cierras cuenta, anonimizados sin link a tu username.
        </li>
        <li>
          Cualquier UGC con copyright de terceros (logos de animes en descripción,
          imágenes ajenas) puede ser eliminado por DMCA.
        </li>
      </ul>
    ),
  },
  {
    id: 'propiedad-intelectual',
    title: 'Propiedad intelectual',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>
          <strong className="text-fg-strong">El código</strong> de AnimeShowdown
          es open source bajo licencia MIT — puedes clonarlo, modificarlo y usarlo
          siempre que mantengas el copyright notice.
        </li>
        <li>
          <strong className="text-fg-strong">Las descripciones de personajes</strong>{' '}
          son obra original o derivada de Jikan (myanimelist), bajo fair use
          educativo. Atribución en{' '}
          <Link to="/api-docs" className="text-gold hover:underline">
            /api-docs
          </Link>
          .
        </li>
        <li>
          <strong className="text-fg-strong">Las imágenes de los personajes</strong>{' '}
          son propiedad de sus respectivos studios de anime. AnimeShowdown las usa
          bajo fair use educativo + comentario (Berne Convention art. 10). Si eres
          titular de derechos, ver{' '}
          <Link to="/dmca" className="text-gold hover:underline">
            política DMCA
          </Link>
          .
        </li>
        <li>
          <strong className="text-fg-strong">Nombre y logo</strong> de AnimeShowdown
          forman parte de la identidad del proyecto — no los uses para productos
          derivados sin permiso.
        </li>
      </ul>
    ),
  },
  {
    id: 'disponibilidad',
    title: 'Disponibilidad del servicio',
    body: (
      <p>
        AnimeShowdown es un proyecto educativo. Sin SLA, sin compromiso de uptime,
        sin compensación por downtime. El servicio depende de proveedores externos
        y puede sufrir interrupciones. Hacemos mejor esfuerzo con monitorización y
        copias operativas, pero no garantizamos disponibilidad.
      </p>
    ),
  },
  {
    id: 'responsabilidad',
    title: 'Limitación de responsabilidad',
    body: (
      <p>
        AnimeShowdown se ofrece "AS IS". El proyecto no se hace responsable de
        pérdida de datos, decisiones de compra basadas en rankings, ni de daños
        indirectos derivados del uso del servicio.
      </p>
    ),
  },
  {
    id: 'cambios',
    title: 'Cambios',
    body: (
      <p>
        Estos términos pueden cambiar. Material updates se anunciarán en home con
        30 días de antelación. Si sigues usando el servicio tras la fecha efectiva
        del cambio, aceptas la versión nueva.
      </p>
    ),
  },
  {
    id: 'ley',
    title: 'Ley aplicable',
    body: (
      <p>
        Estos términos se rigen por la legislación española. Conflictos
        jurisdicción de los tribunales competentes en España. Para usuarios
        europeos los derechos otorgados por GDPR y otras leyes locales obligatorias
        prevalecen sobre esta cláusula.
      </p>
    ),
  },
]

function TermsPage() {
  useSeo({
    title: 'Términos de uso',
    description:
      'Términos y condiciones de uso de AnimeShowdown: aceptación, conducta, propiedad intelectual del catálogo y del UGC.',
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Términos', path: '/terminos' },
        ])}
      />
      <div className="mx-auto max-w-5xl">
        <SealedDocument
          title="Términos de uso"
          docId="Expediente AS-LEG-02 · /terminos"
          lastRevision="16 de mayo de 2026"
          sections={SECTIONS}
        />

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link to="/privacidad" className="hover:text-gold hover:underline">
            Política de privacidad
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/dmca" className="hover:text-gold hover:underline">
            Política DMCA
          </Link>
        </div>
      </div>
    </section>
  )
}

export default TermsPage
