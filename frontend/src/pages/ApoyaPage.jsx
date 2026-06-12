import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Database,
  Globe,
  Heart,
  Lightbulb,
  MessageCircle,
  Server,
  Share2,
  Sparkles,
} from 'lucide-react'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import EmaWall from '../components/EmaWall'
import SupportCandle from '../components/SupportCandle'

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

// Meta mensual transparente. Actualizar a mano cada
// vez que cambie el mes o lleguen donaciones — sin endpoint ni infra,
// el valor más simple es vivir aquí. Si en algún momento entra Ko-fi
// webhook o se quiere parametrizar, mover a variable de entorno.
const META_OBJETIVO_EUR = 25
const META_RECIBIDO_EUR = 0

/**
 * Página /apoya — donaciones opcionales para que el
 * proyecto siga vivo. Ko-fi como plataforma principal + GitHub Sponsors
 * + ayuda gratis (compartir, star, sugerir). Sin pressure: AnimeShowdown
 * sigue siendo gratis aunque no doneis nada.
 *
 * Tono: cercano, transparente, agradecido — nunca de venta. La página
 * explica en qué se usa cada aporte (hosting, base de datos, dominio) y
 * da el mismo peso visual a la ayuda gratis que a la donación.
 */
function ApoyaPage() {
  useSeo({
    title: 'Apoya el proyecto',
    description:
      'AnimeShowdown es gratuito y sin anuncios. Si te entretiene, échame una mano con Ko-fi, GitHub Sponsors o ayuda gratis compartiendo la web.',
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'Apoya', path: '/apoya' },
        ])}
      />
      <div className="mx-auto max-w-3xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold text-gold">
            <Heart className="h-3 w-3" />
            Apoya · Proyecto gratuito
          </span>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Ayuda a mantener AnimeShowdown vivo
          </h1>
          <p className="max-w-2xl text-fg-muted">
            AnimeShowdown es gratuito, sin anuncios y sin venta de datos.
            Lo mantengo en mis horas libres y cualquier euro va directo a
            servidor, dominio y mejoras.
          </p>
          <p className="max-w-2xl text-fg-muted">
            Si la web te entretiene o te ayuda y quieres devolver algo,
            estas son las formas de echar una mano.
          </p>
        </motion.header>

        {/* El muro de ema + la vela del mes. Las cuatro vías de apoyo cuelgan
            del travesaño con el MISMO peso visual — federación agradecida, no
            paywall — y la vela muestra la meta aunque vaya a 0€ (una vela
            apagada pide ser encendida; una barra a 0% comunica fracaso). */}
        <div className="mb-12 flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-8">
          <SupportCandle recibido={META_RECIBIDO_EUR} objetivo={META_OBJETIVO_EUR} />
          <div className="min-w-0 flex-1">
            <EmaWall />
          </div>
        </div>

        {/* ¿En qué ayuda tu apoyo? — transparencia sobre costes reales */}
        <div className="mb-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-lg font-bold text-fg-strong">
            ¿En qué ayuda tu apoyo?
          </h2>
          <p className="mb-5 text-[13px] text-fg-muted">
            Cada aporte ayuda a cubrir los costes reales de mantener
            AnimeShowdown funcionando y a mejorar la plataforma con nuevas
            funciones.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <CosteTile icon={Server} label="Servidor" />
            <CosteTile icon={Database} label="Base de datos" />
            <CosteTile icon={Globe} label="Dominio + CDN" />
            <CosteTile icon={Sparkles} label="Nuevos modos" />
            <CosteTile icon={Heart} label="Más personajes" />
            <CosteTile icon={Lightbulb} label="Mejoras visuales" />
          </div>
        </div>

        {/* Ayuda gratis — mismo peso visual que las donaciones */}
        <div className="mb-10 rounded-2xl border border-success/40 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-6">
          <h2 className="mb-2 text-lg font-bold text-fg-strong">
            También puedes ayudar gratis
          </h2>
          <p className="mb-5 text-[13px] text-fg-muted">
            No hace falta donar para apoyar AnimeShowdown. Compartir la web,
            dejar una estrella o sugerir mejoras también ayuda muchísimo.
          </p>
          <ul className="flex flex-col gap-3">
            <AyudaGratis
              icon={Share2}
              titulo="Comparte AnimeShowdown"
              texto="Pasa la web por Twitter, Discord, Reddit o cualquier comunidad anime cuando votes, juegues o veas un ranking interesante."
            />
            <AyudaGratis
              icon={MessageCircle}
              titulo="Invita a otros a votar"
              texto="Cuanta más gente vote, más interesante y justo se vuelve el ranking ELO."
            />
          </ul>
        </div>

        {/* Promesa */}
        <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
          <p className="text-[13px] leading-relaxed text-success">
            <strong>Compromiso:</strong> AnimeShowdown seguirá siendo
            gratuito, sin anuncios invasivos, sin popups molestos y sin
            funciones importantes detrás de un muro de pago. El código y el
            catálogo se mantienen abiertos en GitHub.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-success/90 transition-colors hover:text-success hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  )
}


function CosteTile({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-gold">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[12px] font-semibold text-fg-strong">{label}</span>
    </div>
  )
}

function AyudaGratis({ icon: Icon, titulo, texto, cta }) {
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-surface/50 p-3 transition-colors hover:border-success/40">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-fg-strong">{titulo}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">
          {texto}
        </p>
        {cta && (
          <a
            href={cta.href}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-success transition-colors hover:text-success hover:underline"
          >
            {cta.label}
            <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </li>
  )
}

export default ApoyaPage
