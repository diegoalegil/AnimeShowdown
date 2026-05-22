import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronDown, ExternalLink, HelpCircle, Search } from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema, faqPageSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { EmptyStateScene } from '../components/VisualSystem'

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
    categoria: 'Para empezar',
    pregunta: '¿Qué es AnimeShowdown?',
    respuesta:
      'Una plataforma para enfrentar a personajes de anime cara a cara. Tú votas en cada duelo y la comunidad va decidiendo quién manda en el ranking ELO. Gratis y sin anuncios.',
  },
  {
    categoria: 'Ranking',
    pregunta: '¿Cómo funciona el ranking ELO?',
    respuesta:
      'Cada personaje empieza con 1500 puntos. Ganar un duelo le suma puntos en función del rival: si bates a alguien fuerte sube mucho, si vences a alguien por debajo sube poco. Es el mismo sistema que se usa en ajedrez competitivo. El ranking se actualiza al instante con cada voto.',
  },
  {
    categoria: 'Torneos',
    pregunta: '¿Qué son los torneos?',
    respuesta:
      'Brackets de 8 o 16 personajes a eliminación directa. Cada ronda dura mientras la comunidad vota; cuando cierra, el ganador pasa a la siguiente. Hay torneos curados por nosotros y torneos creados por usuarios verificados — todos visibles en /torneos.',
  },
  {
    categoria: 'Torneos',
    pregunta: '¿Puedo crear mi propio torneo?',
    respuesta:
      'Sí. Cualquier cuenta con email verificado puede crearlo desde /torneos/crear: eliges 8 o 16 personajes, le pones nombre y descripción, y lo revisamos antes de hacerlo público (suele ser en menos de 24 horas).',
  },
  {
    categoria: 'Torneos',
    pregunta: '¿Qué son las predicciones?',
    respuesta:
      'Mientras un torneo está activo puedes predecir quién avanzará en cada match. Cuando el duelo se resuelve, sumas un acierto a tu ratio. Encadenar 3, 10 o 20 aciertos seguidos desbloquea logros.',
  },
  {
    categoria: 'Cuenta',
    pregunta: '¿Cómo veo el perfil de otros usuarios?',
    respuesta:
      'Cada usuario tiene su perfil público en /u/su-nombre con sus stats, su top de personajes, sus logros y a quién sigue. Desde ahí puedes empezar a seguirle y recibir aviso cuando él te siga.',
  },
  {
    categoria: 'Para empezar',
    pregunta: '¿AnimeShowdown es gratis?',
    respuesta:
      'Sí, gratis y sin anuncios. Sin trackers de terceros, sin planes de pago, sin funciones bloqueadas. Si quieres echar una mano, hay una página /apoya con donaciones opcionales.',
  },
  {
    categoria: 'Soporte',
    pregunta: '¿Quién está detrás del proyecto?',
    respuesta:
      'AnimeShowdown lo mantiene una persona en sus horas libres, desde Tenerife. Si tienes una idea, un bug o quieres saludar, escribe a soporte@animeshowdown.dev.',
  },
  {
    categoria: 'Catálogo',
    pregunta: '¿Cómo añado un personaje que falta?',
    respuesta:
      'Encontrarás un botón "Sugiere un personaje" en /personajes. Sirve para proponer un personaje suelto o un anime entero — la sugerencia se revisa y se añade al catálogo si encaja.',
  },
  {
    categoria: 'Cuenta',
    pregunta: '¿Mis datos están seguros?',
    respuesta:
      'Sí. La contraseña se guarda cifrada, puedes activar verificación en dos pasos, hay límite de intentos de login y el email tiene que estar verificado para acciones sensibles. No usamos trackers de publicidad ni vendemos tus datos a nadie.',
  },
]

const CATEGORIAS = ['Todas', ...new Set(FAQ.map((item) => item.categoria))]

function normalizarFaq(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function FaqPage() {
  useSeo({
    title: 'Preguntas frecuentes',
    description:
      'Cómo funciona el ranking ELO de AnimeShowdown, cómo crear torneos, cómo se hacen las predicciones y todo lo que necesitas saber.',
  })

  const [abiertaPregunta, setAbiertaPregunta] = useState(FAQ[0]?.pregunta ?? null)
  const [categoria, setCategoria] = useState('Todas')
  const [filtro, setFiltro] = useState('')
  const visibles = useMemo(() => {
    const q = normalizarFaq(filtro.trim())
    return FAQ.filter((item) => {
      if (categoria !== 'Todas' && item.categoria !== categoria) return false
      if (!q) return true
      return normalizarFaq(`${item.pregunta} ${item.respuesta} ${item.categoria}`).includes(q)
    })
  }, [categoria, filtro])

  const preguntaAbiertaVisible = visibles.some((item) => item.pregunta === abiertaPregunta)
    ? abiertaPregunta
    : visibles[0]?.pregunta ?? null

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
            Todo lo que necesitas saber sobre AnimeShowdown sin tener que
            escribirnos. Si tu pregunta no está aquí, puedes mandarnos un
            correo a soporte@animeshowdown.dev.
          </p>
        </motion.header>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg px-3">
            <Search className="h-4 w-4 text-fg-muted" />
            <span className="sr-only">Buscar en FAQ</span>
            <input
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Busca por ELO, torneos, cuenta..."
              className="min-w-0 flex-1 bg-transparent text-sm text-fg-strong placeholder:text-fg-muted focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`min-h-10 rounded-lg px-3 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                  categoria === cat
                    ? 'bg-gold text-bg'
                    : 'border border-border bg-bg text-fg-muted hover:text-fg-strong'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {visibles.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visibles.map((item) => (
              <FaqItem
                key={item.pregunta}
                item={item}
                abierta={item.pregunta === preguntaAbiertaVisible}
                onToggle={() => setAbiertaPregunta(
                  item.pregunta === preguntaAbiertaVisible ? null : item.pregunta,
                )}
              />
            ))}
          </ul>
        ) : (
          <EmptyStateScene
            icon={HelpCircle}
            title={`Sin respuestas para "${filtro}"`}
          >
            <p>Prueba con ranking, torneos, cuenta o privacidad.</p>
            <button
              type="button"
              onClick={() => { setFiltro(''); setCategoria('Todas') }}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-accent/50 bg-accent/90 px-5 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              Limpiar búsqueda
            </button>
          </EmptyStateScene>
        )}

        <div className="mt-10 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-fg-strong">
            ¿No has encontrado tu respuesta?
          </h2>
          <p className="mt-2 text-[13px] text-fg-muted">
            Escríbenos a soporte@animeshowdown.dev — leemos todo. Si
            quieres ojear el código o reportar un bug técnico, también
            tenemos repo público en GitHub.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="mailto:soporte@animeshowdown.dev"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              Escribir a soporte
            </a>
            <a
              href="https://github.com/diegoalegil/AnimeShowdown/issues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-fg-strong transition-colors hover:border-accent hover:text-gold"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Reportar bug en GitHub
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link
            to="/personajes"
            className="hover:text-gold hover:underline"
          >
            Catálogo de personajes
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/torneos" className="hover:text-gold hover:underline">
            Torneos activos
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/ranking" className="hover:text-gold hover:underline">
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
        <span className="ml-auto hidden rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted sm:inline-flex">
          {item.categoria}
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
