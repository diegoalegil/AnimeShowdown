import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
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
 * Política de privacidad (Plan v2 §16.13).
 *
 * <p>Cumple GDPR mínimo: qué datos guardamos, por cuánto tiempo, quién
 * los procesa, cómo ejercer derechos del usuario. No usa Termly ni
 * generador legal porque AnimeShowdown es proyecto educativo open
 * source con stack acotado y la política se mantiene legible en menos
 * de 1 página.
 *
 * <p>Importante: las URLs y datos de contacto son reales pero el
 * proyecto NO está registrado como entidad jurídica. Esto es portafolio.
 */
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
      <div className="mx-auto max-w-3xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
            <Shield className="h-3 w-3" />
            Legal
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Política de privacidad
          </h1>
          <p className="max-w-2xl text-[13px] text-fg-muted">
            Última actualización: 16 mayo 2026. AnimeShowdown es un proyecto
            independiente mantenido por una persona, con código abierto en
            GitHub. Esta política explica qué datos personales recopilamos
            y cómo se usan.
          </p>
        </motion.header>

        <article className="prose prose-invert flex flex-col gap-6 text-[14px] leading-relaxed text-fg-muted">
          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              1 · Quién es el responsable
            </h2>
            <p>
              Diego Alegil García, residente en Tenerife (Islas Canarias, España).
              Contacto:{' '}
              <a
                href="mailto:diegogildam@gmail.com"
                className="text-gold hover:underline"
              >
                diegogildam@gmail.com
              </a>
              . AnimeShowdown no es una entidad jurídica registrada — es un
              proyecto independiente con código abierto bajo licencia MIT.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              2 · Qué datos recopilamos
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-fg-strong">Email + username + contraseña hasheada</strong>{' '}
                cuando creas cuenta. La contraseña se guarda con bcrypt (no
                vemos la original).
              </li>
              <li>
                <strong className="text-fg-strong">Votos, predicciones, torneos creados, follows</strong>{' '}
                vinculados a tu cuenta para construir tu perfil público.
              </li>
              <li>
                <strong className="text-fg-strong">Logs de auth</strong> (login,
                logout, cambios de contraseña, 2FA) con timestamp e IP en el
                registro de seguridad durante 90 días — para detectar accesos sospechosos.
              </li>
              <li>
                <strong className="text-fg-strong">Métricas de rendimiento</strong>{' '}
                (Web Vitals como LCP, INP, CLS) enviadas a Sentry para
                diagnóstico. Sin datos personales, sin replay de sesión.
              </li>
              <li>
                <strong className="text-fg-strong">localStorage local</strong>{' '}
                con preferencias (idioma, sesión y progreso de juegos diarios).
                Nunca sale de tu navegador.
              </li>
            </ul>
            <p className="mt-3">
              <strong className="text-fg-strong">Lo que NO recopilamos:</strong>{' '}
              tracking publicitario, cookies de terceros, datos de localización
              precisa, fingerprinting, datos biométricos.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              3 · Para qué los usamos
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Autenticarte y mantener tu sesión activa (JWT 15min + refresh 30d).</li>
              <li>Mostrar tu perfil público en <code className="text-fg-strong">/u/{'{'}username{'}'}</code> con stats y logros.</li>
              <li>Computar el ranking ELO global a partir de los votos.</li>
              <li>Enviarte emails transaccionales (verificación, reset de contraseña, notif suscripción).</li>
              <li>Detectar abusos (5 intentos de login fallidos → 15min bloqueado, sin más).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              4 · Quién procesa tus datos
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-fg-strong">Railway</strong> (US) — hosting
                del backend Spring Boot.
              </li>
              <li>
                <strong className="text-fg-strong">Neon</strong> (US/EU región
                Frankfurt) — base de datos PostgreSQL.
              </li>
              <li>
                <strong className="text-fg-strong">Cloudflare Pages</strong> (CDN
                global) — hosting estático del frontend.
              </li>
              <li>
                <strong className="text-fg-strong">Cloudflare R2</strong> (EU) —
                backups diarios encriptados de la BBDD.
              </li>
              <li>
                <strong className="text-fg-strong">Resend</strong> (EU) — envío
                de emails transaccionales.
              </li>
              <li>
                <strong className="text-fg-strong">Sentry</strong> (EU región
                de.sentry.io) — métricas de errores y Web Vitals. Sin replay
                de sesión, sin PII.
              </li>
            </ul>
            <p className="mt-3">
              Todos son proveedores con cláusulas GDPR estándar (DPA) y
              encriptación at-rest e in-transit.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              5 · Cuánto tiempo guardamos los datos
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-fg-strong">Cuenta activa:</strong>{' '}
                mientras la mantengas. Puedes eliminarla en cualquier momento.
              </li>
              <li>
                <strong className="text-fg-strong">Registro de seguridad auth:</strong> 90
                días, luego se purga automáticamente.
              </li>
              <li>
                <strong className="text-fg-strong">Backups Neon → R2:</strong>{' '}
                7 días diarios, 28 días semanales, 365 días mensuales.
              </li>
              <li>
                <strong className="text-fg-strong">Métricas Sentry:</strong> 30
                días por defecto del free tier.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              6 · Tus derechos GDPR
            </h2>
            <p className="mb-2">Puedes en cualquier momento:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Acceder a una copia de tus datos (export JSON).</li>
              <li>Rectificarlos (cambiar email, username, etc.).</li>
              <li>Eliminar tu cuenta y todos los datos asociados.</li>
              <li>Oponerte al procesamiento (te das de baja).</li>
              <li>Portabilidad (export en formato máquina-legible).</li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos, escríbeme a{' '}
              <a
                href="mailto:diegogildam@gmail.com"
                className="text-gold hover:underline"
              >
                diegogildam@gmail.com
              </a>
              . Respuesta en menos de 30 días según GDPR.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              7 · Cookies
            </h2>
            <p>
              AnimeShowdown <strong className="text-fg-strong">no usa cookies de
              tracking ni de publicidad</strong>. Solo:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <code className="text-fg-strong">refresh_token</code> — cookie
                httpOnly necesaria para mantener sesión sin volver a logear cada
                15 min. Funcional, sin tracking.
              </li>
              <li>
                <code className="text-fg-strong">localStorage</code> con
                preferencias (idioma, sesión, progreso de juegos). Nunca sale de
                tu navegador.
              </li>
            </ul>
            <p className="mt-3">
              No mostramos banner de cookies porque la ePrivacy directive solo
              lo exige cuando hay cookies de tracking. Si en el futuro
              activamos session replay de Sentry, mostraremos banner.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-fg-strong">
              8 · Cambios en esta política
            </h2>
            <p>
              Cualquier modificación material se anunciará en{' '}
              <Link to="/" className="text-gold hover:underline">
                la home
              </Link>{' '}
              con 30 días de antelación. La versión actual queda visible en
              esta misma página con fecha de última actualización arriba.
            </p>
          </section>
        </article>

        <div className="mt-10 flex flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link to="/terminos" className="hover:text-gold hover:underline">
            Términos de uso
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/dmca" className="hover:text-gold hover:underline">
            Política DMCA
          </Link>
          <span aria-hidden="true">·</span>
          <a
            href="mailto:diegogildam@gmail.com"
            className="hover:text-gold hover:underline"
          >
            Contacto
          </a>
        </div>
      </div>
    </section>
  )
}

export default PrivacyPage
