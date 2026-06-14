import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import SealedDocument from '../components/SealedDocument'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_MAILTO,
  PRIVACY_PROVIDERS,
} from '../data/legal'

/**
 * Política de privacidad mantenida como texto de producto: datos tratados,
 * proveedores, conservación, cookies esenciales y derechos del usuario.
 * El texto legal vive intacto en `sections[].body`; SealedDocument solo aporta
 * el layout de documento de archivo sellado (cabecera con sello, índice
 * scroll-spy, cuerpo de lectura).
 */
const SECTIONS = [
  {
    id: 'responsable',
    title: 'Quién es el responsable',
    body: (
      <p>
        Responsable del servicio: AnimeShowdown. Contacto legal:{' '}
        <a href={LEGAL_CONTACT_MAILTO} className="text-gold hover:underline">
          {LEGAL_CONTACT_EMAIL}
        </a>
        . AnimeShowdown es un proyecto independiente con código abierto bajo
        licencia MIT.
      </p>
    ),
  },
  {
    id: 'datos',
    title: 'Qué datos recopilamos',
    body: (
      <>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong className="text-fg-strong">Email + username + contraseña hasheada</strong>{' '}
            cuando creas cuenta. La contraseña se guarda con bcrypt (no vemos la
            original).
          </li>
          <li>
            <strong className="text-fg-strong">Votos, predicciones, torneos creados, follows</strong>{' '}
            vinculados a tu cuenta para construir tu perfil público.
          </li>
          <li>
            <strong className="text-fg-strong">Logs de auth</strong> (login,
            logout, cambios de contraseña, 2FA) con timestamp e IP en el registro
            de seguridad durante 90 días — para detectar accesos sospechosos.
          </li>
          <li>
            <strong className="text-fg-strong">Métricas de rendimiento</strong>{' '}
            (Web Vitals como LCP, INP, CLS) y errores técnicos enviados a Sentry
            solo si el despliegue tiene DSN configurado. Sin cookies, sin IP por
            defecto; el replay solo se activa ante errores y con texto enmascarado.
          </li>
          <li>
            <strong className="text-fg-strong">localStorage local</strong> con
            preferencias (idioma, sonido, progreso de juegos diarios) y una copia
            ligera del usuario para mejorar la UX. El JWT de acceso vive en
            memoria y no se guarda en localStorage.
          </li>
        </ul>
        <p className="mt-3">
          <strong className="text-fg-strong">Lo que NO recopilamos:</strong>{' '}
          tracking publicitario, cookies de terceros, datos de localización
          precisa, fingerprinting, datos biométricos.
        </p>
      </>
    ),
  },
  {
    id: 'uso',
    title: 'Para qué los usamos',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>Autenticarte y mantener tu sesión activa (JWT 15min + refresh 30d).</li>
        <li>Mostrar tu perfil público en <code className="text-fg-strong">/u/{'{'}username{'}'}</code> con stats y logros.</li>
        <li>Computar el ranking ELO global a partir de los votos.</li>
        <li>Enviarte emails transaccionales (verificación, reset de contraseña, notif suscripción).</li>
        <li>Detectar abusos (5 intentos de login fallidos → 15min bloqueado, sin más).</li>
      </ul>
    ),
  },
  {
    id: 'proveedores',
    title: 'Quién procesa tus datos',
    body: (
      <>
        <ul className="list-inside list-disc space-y-1">
          {PRIVACY_PROVIDERS.map((provider) => (
            <li key={provider.name}>
              <strong className="text-fg-strong">{provider.name}</strong> —{' '}
              {provider.description}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          No vendemos datos ni los usamos para publicidad. Los proveedores se
          usan para operar el producto, autenticar usuarios, entregar contenido y
          diagnosticar errores técnicos.
        </p>
      </>
    ),
  },
  {
    id: 'retencion',
    title: 'Cuánto tiempo guardamos los datos',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>
          <strong className="text-fg-strong">Cuenta activa:</strong> mientras la
          mantengas. Puedes eliminarla en cualquier momento.
        </li>
        <li>
          <strong className="text-fg-strong">Registro de seguridad auth:</strong> 90
          días, luego se purga automáticamente.
        </li>
        <li>
          <strong className="text-fg-strong">Backups y logs operativos:</strong>{' '}
          según la política técnica vigente del proveedor y solo para continuidad
          del servicio.
        </li>
        <li>
          <strong className="text-fg-strong">Métricas de errores:</strong>{' '}
          retención limitada a la configuración activa del servicio si Sentry está
          habilitado en el despliegue.
        </li>
      </ul>
    ),
  },
  {
    id: 'derechos',
    title: 'Tus derechos GDPR',
    body: (
      <>
        <p className="mb-2">Puedes en cualquier momento:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Acceder a una copia de tus datos (export JSON).</li>
          <li>Rectificarlos (cambiar email, username, etc.).</li>
          <li>Eliminar tu cuenta y todos los datos asociados.</li>
          <li>Oponerte al procesamiento (te das de baja).</li>
          <li>Portabilidad (export en formato máquina-legible).</li>
        </ul>
        <p className="mt-3">
          Para ejercer cualquiera de estos derechos, escribe a{' '}
          <a href={LEGAL_CONTACT_MAILTO} className="text-gold hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          . Respuesta en menos de 30 días según GDPR.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: (
      <>
        <p>
          AnimeShowdown <strong className="text-fg-strong">no usa cookies de
          tracking ni de publicidad</strong>. Solo:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <code className="text-fg-strong">refresh_token</code> — cookie
            httpOnly necesaria para mantener sesión sin volver a iniciar sesión
            cada 15 minutos. Funcional, sin tracking y no accesible desde
            JavaScript.
          </li>
          <li>
            <code className="text-fg-strong">localStorage</code> con preferencias,
            progreso local de juegos y una copia ligera del usuario para pintar la
            interfaz antes del refresh. Nunca contiene el JWT de acceso.
          </li>
        </ul>
        <p className="mt-3">
          No mostramos banner de cookies porque la ePrivacy directive solo lo
          exige cuando hay cookies de tracking o publicidad. Si en el futuro
          añadimos analítica no esencial, se pedirá consentimiento antes de
          activarla.
        </p>
      </>
    ),
  },
  {
    id: 'cambios',
    title: 'Cambios en esta política',
    body: (
      <p>
        Cualquier modificación material se anunciará en{' '}
        <Link to="/" className="text-gold hover:underline">
          la home
        </Link>{' '}
        con 30 días de antelación. La versión actual queda visible en esta misma
        página con fecha de última actualización arriba.
      </p>
    ),
  },
]

function PrivacyPage() {
  useSeo({
    title: 'Política de privacidad',
    description:
      'Qué datos guarda AnimeShowdown, por cuánto tiempo, cómo ejercer tus derechos GDPR. Cero tracking de terceros, datos mínimos.',
    noindex: false, // SÍ indexable por compliance/transparencia
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Privacidad', path: '/privacidad' },
        ])}
      />
      <div className="mx-auto max-w-5xl">
        <SealedDocument
          title="Política de privacidad"
          docId="Expediente AS-LEG-01 · /privacidad"
          lastRevision="16 de mayo de 2026"
          sections={SECTIONS}
        />

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link to="/terminos" className="hover:text-gold hover:underline">
            Términos de uso
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/dmca" className="hover:text-gold hover:underline">
            Política DMCA
          </Link>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_CONTACT_MAILTO} className="hover:text-gold hover:underline">
            Contacto
          </a>
        </div>
      </div>
    </section>
  )
}

export default PrivacyPage
