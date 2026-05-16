import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronDown, ExternalLink, HelpCircle } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
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
 * Lista de preguntas frecuentes (Plan v2 §5.10).
 *
 * <p>Mantenida en este array porque son ~10 preguntas estables y traerlas
 * del backend / CMS sería sobre-ingeniería. Cuando crezca a 30+ o queramos
 * editarlas sin redeploy, mover a una tabla {@code faq_items} con admin UI.
 *
 * <p>El texto de las respuestas se renderiza tal cual + se serializa
 * idéntico en el JSON-LD FAQPage. Cambia copy aquí y Google ve lo mismo
 * que el usuario — no hay riesgo de desync.
 */
const FAQ = [
  {
    pregunta: '¿Qué es AnimeShowdown?',
    respuesta:
      'AnimeShowdown es una plataforma para votar enfrentamientos cara a cara entre personajes de anime. Cada voto suma puntos al ranking ELO global de cada personaje y los torneos van resolviendo el bracket en directo. Es gratis y open source.',
  },
  {
    pregunta: '¿Cómo funciona el ranking ELO?',
    respuesta:
      'Cada personaje empieza con 1500 puntos. Al ganar un enfrentamiento sube su ELO en función del rival (subes más si ganas a uno con ELO alto; menos si vencias a uno más bajo). Es el mismo sistema que usan chess.com y otras competiciones competitivas. El ranking se actualiza al instante después de cada voto.',
  },
  {
    pregunta: '¿Qué son los torneos?',
    respuesta:
      'Brackets de 8 o 16 personajes en eliminación directa. Cada ronda dura mientras la comunidad vota; al cerrarse, el ganador pasa a la siguiente ronda. Hay torneos creados por administradores (catálogo curado) y torneos creados por usuarios verificados, todos visibles en /torneos.',
  },
  {
    pregunta: '¿Puedo crear mi propio torneo?',
    respuesta:
      'Sí, cualquier cuenta con email verificado puede crear torneos personalizados desde /torneos/crear. Eliges 8 o 16 personajes, le pones nombre y descripción, y queda en cola de revisión. Un admin lo revisa antes de hacerlo público (suele ser <24h).',
  },
  {
    pregunta: '¿Qué son las predicciones?',
    respuesta:
      'Mientras un torneo está activo puedes predecir quién avanzará en cada bracket. Cuando el match se resuelve, AnimeShowdown comprueba tus predicciones y suma puntos a tu ratio de aciertos. Acertar 3, 10 o 20 predicciones seguidas desbloquea logros específicos.',
  },
  {
    pregunta: '¿Cómo veo el perfil de otros usuarios?',
    respuesta:
      'Cada usuario tiene su perfil público en /u/{username} con sus stats, top de personajes votados, logros desbloqueados y followers. Desde ahí puedes seguir a otros y recibir notificaciones cuando ellos te sigan a ti.',
  },
  {
    pregunta: '¿AnimeShowdown es gratis?',
    respuesta:
      'Sí, totalmente. Sin anuncios, sin tracking de terceros y sin planes de pago. Es un proyecto portfolio open source — el código vive en GitHub bajo licencia MIT.',
  },
  {
    pregunta: '¿Quién creó AnimeShowdown?',
    respuesta:
      'Lo desarrolla Diego Alegil, estudiante de DAM (Desarrollo de Aplicaciones Multiplataforma). El stack es React 19 + Vite 8 + Tailwind v4 en el frontend, Spring Boot 3 + Java 21 + PostgreSQL en el backend, desplegado en Cloudflare Pages + Railway + Neon.',
  },
  {
    pregunta: '¿Cómo añado un personaje que falta?',
    respuesta:
      'Si echas en falta a alguien, hay un botón "Sugiere un personaje" en /personajes que abre un issue en GitHub. También puedes proponer animes enteros — el ingesto se hace por lotes desde Jikan/AniList.',
  },
  {
    pregunta: '¿Mis datos están seguros?',
    respuesta:
      'Sí. Las contraseñas se guardan con bcrypt, JWT corto de 15min en memoria + refresh token httpOnly de 30d, opción de 2FA TOTP con códigos de respaldo, rate limiting en login (5 intentos/minuto) y verificación de email obligatoria. Sin trackers de terceros: solo telemetría agregada con Sentry para errores en frontend.',
  },
]

function FaqPage() {
  useSeo({
    title: 'Preguntas frecuentes',
    description:
      'Cómo funciona el ranking ELO de AnimeShowdown, cómo crear torneos, cómo se hacen las predicciones y todo lo que necesitas saber.',
  })

  const [abiertaIdx, setAbiertaIdx] = useState(0)

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd id="faq" schema={faqPageSchema(FAQ)} />
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'FAQ', path: '/faq' },
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
            <HelpCircle className="h-3 w-3" />
            FAQ
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Preguntas frecuentes
          </h1>
          <p className="max-w-2xl text-fg-muted">
            Todo lo que necesitas saber sobre AnimeShowdown, sin tener que
            mandar un mensaje. Si tu pregunta no está aquí, puedes abrir un
            issue en GitHub.
          </p>
        </motion.header>

        <ul className="flex flex-col gap-2">
          {FAQ.map((item, idx) => (
            <FaqItem
              key={item.pregunta}
              item={item}
              abierta={idx === abiertaIdx}
              onToggle={() => setAbiertaIdx(idx === abiertaIdx ? -1 : idx)}
            />
          ))}
        </ul>

        <div className="mt-10 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-fg-strong">
            ¿No has encontrado tu respuesta?
          </h2>
          <p className="mt-2 text-[13px] text-fg-muted">
            El proyecto es open source — puedes abrir un issue en GitHub,
            sugerir personajes nuevos o revisar el código directamente.
          </p>
          <a
            href="https://github.com/diegoalegil/AnimeShowdown/issues"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir issue en GitHub
          </a>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link
            to="/personajes"
            className="hover:text-accent hover:underline"
          >
            Catálogo de personajes
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/torneos" className="hover:text-accent hover:underline">
            Torneos activos
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/ranking" className="hover:text-accent hover:underline">
            Ranking ELO
          </Link>
        </div>
      </div>
    </section>
  )
}

function FaqItem({ item, abierta, onToggle }) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-accent/40"
      >
        <span className="text-[15px] font-semibold text-fg-strong">
          {item.pregunta}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-muted transition-transform ${
            abierta ? 'rotate-180' : ''
          }`}
        />
      </button>
      {abierta && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden rounded-b-xl border-x border-b border-border bg-bg px-5 py-4 text-[14px] leading-relaxed text-fg-muted"
        >
          {item.respuesta}
        </motion.div>
      )}
    </li>
  )
}

export default FaqPage
