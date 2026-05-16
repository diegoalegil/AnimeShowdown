import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coffee, Heart, MessageCircle } from 'lucide-react'
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
 * Página /apoya (Plan v2 §12.1) — donaciones opcionales para que el
 * proyecto siga vivo. Ko-fi como plataforma principal (no comisiones
 * mensuales, no scam Patreon). Sin pressure: AnimeShowdown sigue siendo
 * gratis aunque no doneis nada.
 *
 * <p>Sin Stripe Premium ($3/mes, Plan v2 §12.2) por ahora — añadir un
 * tier de pago requiere setup de Stripe + features exclusivas + manejo
 * de roles de usuario. Cuando haya volumen real se evalúa.
 */
function ApoyaPage() {
  useSeo({
    title: 'Apoya el proyecto',
    description:
      'AnimeShowdown es gratis y open source. Si quieres ayudar a que siga vivo: Ko-fi, GitHub Sponsors o simplemente compartir el sitio.',
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
      <div className="mx-auto max-w-2xl">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">
            <Heart className="h-3 w-3" />
            Apoya
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Mantén vivo el proyecto
          </h1>
          <p className="max-w-2xl text-fg-muted">
            AnimeShowdown es gratis y siempre lo será. Sin anuncios, sin
            tracking de terceros, sin tier de pago bloqueando features. Lo
            mantengo en mis horas libres mientras estudio DAM. Si te ayuda o
            te entretiene, estas son las formas de apoyar.
          </p>
        </motion.header>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <a
            href="https://ko-fi.com/diegoalegil"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 transition-all hover:-translate-y-0.5 hover:border-amber-500/60"
          >
            <div className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-amber-300" />
              <p className="text-[12px] font-semibold uppercase tracking-wider text-amber-300">
                Ko-fi
              </p>
            </div>
            <h2 className="text-lg font-bold text-fg-strong">
              Invítame a un café
            </h2>
            <p className="text-[13px] text-fg-muted">
              Donación puntual desde 3€. Sin comisiones mensuales, paypal o
              tarjeta. Va directo a cubrir Railway, Neon y Cloudflare cuando
              salgan de free tier.
            </p>
          </a>

          <a
            href="https://github.com/sponsors/diegoalegil"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40"
          >
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-fg-muted" />
              <p className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted">
                GitHub Sponsors
              </p>
            </div>
            <h2 className="text-lg font-bold text-fg-strong">
              Sponsor recurrente
            </h2>
            <p className="text-[13px] text-fg-muted">
              Para apoyar el repositorio open source mensualmente. Visible
              públicamente en mi perfil de GitHub.
            </p>
          </a>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Apoyar sin gastar
          </h2>
          <ul className="flex flex-col gap-3 text-[14px] text-fg-muted">
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg text-accent">
                <MessageCircle className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong className="text-fg-strong">Comparte</strong> en
                Twitter/Discord/Reddit cuando voto en un torneo que te
                interesa. La etiqueta @AnimeShowdown llega.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg text-accent">
                <Heart className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong className="text-fg-strong">Star en GitHub</strong>{' '}
                ayuda a que más devs descubran el proyecto y contribuyan.{' '}
                <a
                  href="https://github.com/diegoalegil/AnimeShowdown"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Repositorio →
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg text-accent">
                <Heart className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong className="text-fg-strong">Sugiere mejoras</strong> o
                personajes que faltan{' '}
                <a
                  href="https://github.com/diegoalegil/AnimeShowdown/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  abriendo un issue
                </a>
                . Cada idea ayuda a priorizar el roadmap.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <p className="text-[13px] text-emerald-200">
            <strong>Promesa:</strong> AnimeShowdown nunca tendrá anuncios,
            popups ni "pay to skip ads". Los datos del catálogo siempre
            quedarán bajo licencia MIT.
          </p>
          <Link
            to="/"
            className="mt-3 inline-flex text-[12px] text-emerald-300/80 hover:text-emerald-200 hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  )
}

export default ApoyaPage
