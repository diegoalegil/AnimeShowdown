import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Code2, ExternalLink } from 'lucide-react'
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
 * Página pública /api-docs con shape de los endpoints.
 *
 * <p>Sirve a tres públicos:
 * <ul>
 *   <li>Devs que quieren consumir la API sin auth (catálogo, ranking).</li> *   <li>Quien quiera ver el OpenAPI completo de Swagger UI del backend.</li>
 * </ul>
 *
 * <p>Mantengo la lista a mano (en lugar de auto-generarla del OpenAPI)
 * porque está pensada para humanos — con descripción curada,
 * ejemplo de respuesta y posibles errores. El Swagger UI del backend
 * sigue siendo la fuente de verdad para developers strictos.
 */

const SECCIONES = [
  {
    titulo: 'Personajes',
    descripcion:
      'Catálogo completo del frontend cliente-side reflejado en el backend con stats persistidos.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/personajes',
        desc: 'Lista todos los personajes con id, slug, nombre, anime, descripción, imagenUrl.',
        ejemplo: '[{ "id": 1, "slug": "akame", "nombre": "Akame", "anime": "Akame ga Kill!", "imagenUrl": "/img/Akame_ga_Kill/akame.webp" }, ...]',
      },
      {
        metodo: 'GET',
        path: '/api/personajes/{id}',
        desc: 'Detalle de un personaje por id numérico.',
      },
      {
        metodo: 'GET',
        path: '/api/personajes/{slug}',
        desc: 'Detalle de un personaje por slug URL-safe.',
      },
    ],
  },
  {
    titulo: 'Torneos',
    descripcion:
      'Brackets de eliminación directa. Estados SCHEDULED → IN_PROGRESS → FINISHED.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/torneos',
        desc: 'Listado de torneos visibles públicamente (NO_APLICA admin + APROBADO user).',
      },
      {
        metodo: 'GET',
        path: '/api/torneos/slug/{slug}',
        desc: 'Detalle del torneo + bracket completo (enfrentamientos por ronda).',
      },
    ],
  },
  {
    titulo: 'Ranking',
    descripcion:
      'Ranking competitivo público de personajes. Se alimenta de votos y actividad agregada.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/votos/ranking',
        desc: 'Ranking competitivo flat — array ordenado descendente por puntuación.',
      },
      {
        metodo: 'GET',
        path: '/api/votos/ranking/segmentado?periodo=all|mes|trimestre|anio&anime=&limit=',
        desc: 'Ranking por ventana temporal o por anime concreto.',
      },
      {
        metodo: 'GET',
        path: '/api/votos/ranking/animes-disponibles',
        desc: 'Lista de animes que tienen al menos 1 voto, para popular el dropdown del frontend.',
      },
    ],
  },
  {
    titulo: 'Votar',
    descripcion:
      'Duelos casuales y sugeridos para que el usuario pueda participar incluso cuando no hay torneo abierto.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/votar/sugerir-duelo',
        desc: 'Propone dos personajes del top 200 con ELO estimado similar y baja exposición reciente. Cache-Control: no-store.',
      },
      {
        metodo: 'GET',
        path: '/api/enfrentamientos/aleatorio',
        desc: 'Devuelve un enfrentamiento real abierto de torneo, si existe; 404 activa el modo casual.',
      },
    ],
  },
  {
    titulo: 'Perfiles públicos',
    descripcion:
      'Datos públicos por username (sin email). Si vas autenticado, el endpoint añade flags siguiendo/esMismoUsuario.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/perfil/{username}',
        desc: 'Perfil agregado: stats + top personajes + logros + counts de follow.',
      },
      {
        metodo: 'GET',
        path: '/api/seguidores/usuario/{username}/{seguidos|seguidores|stats}',
        desc: 'Listas de quién sigue o es seguido por el usuario.',
      },
    ],
  },
  {
    titulo: 'Logros',
    descripcion: 'Catálogo de 14 badges con rareza 1-5.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/logros',
        desc: 'Catálogo público de badges con código, nombre, descripción, icono lucide, rareza.',
      },
    ],
  },
  {
    titulo: 'Predicciones',
    descripcion: 'Leaderboard de aciertos en torneos resueltos.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/predicciones/leaderboard?dias=30&limit=10',
        desc: 'Top predictores en los últimos N días.',
      },
    ],
  },
  {
    titulo: 'Estado',
    descripcion: 'Disponibilidad pública calculada desde muestras persistidas del healthcheck backend.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/status',
        desc: 'Uptime y latencia agregados para 24h, 7d, 30d y 90d. Cache-Control: no-store.',
      },
    ],
  },
  {
    titulo: 'OG images',
    descripcion:
      'PNG dinámicos para previews en Twitter/Discord/WhatsApp. Cache 7 días en Cloudflare.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/og/personaje/{slug}.png',
        desc: 'OG image 1200x630 con avatar + nombre + anime del personaje.',
      },
      {
        metodo: 'GET',
        path: '/api/og/torneo/{slug}.png',
        desc: 'OG image 1200x630 con bracket + nombre del torneo.',
      },
      {
        metodo: 'GET',
        path: '/api/og/ranking.png',
        desc: 'OG image 1200x630 con top global del ranking.',
      },
      {
        metodo: 'GET',
        path: '/api/og/anime/{slug}.png',
        desc: 'OG image 1200x630 con top de personajes de un anime.',
      },
      {
        metodo: 'GET',
        path: '/api/og/pvp.png',
        desc: 'OG image 1200x630 para el modo duelo PvP live.',
      },
    ],
  },
]

function ApiDocsPage() {
  useSeo({
    title: 'API pública',
    description:
      'Endpoints REST públicos de AnimeShowdown: catálogo de personajes, ranking competitivo, torneos, perfiles, predicciones, OG images. Sin auth para lectura.',
  })

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'API docs', path: '/api-docs' },
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
            <Code2 className="h-3 w-3" />
            API pública
          </span>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight">
            Endpoints REST
          </h1>
          <p className="max-w-2xl text-fg-muted">
            AnimeShowdown expone una API REST pública para lectura del catálogo
            de personajes, ranking competitivo, torneos y perfiles. Sin auth para los
            endpoints de abajo. Spec completo en OpenAPI/Swagger.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href="https://api.animeshowdown.dev/swagger-ui.html"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Swagger UI interactivo
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href="https://api.animeshowdown.dev/v3/api-docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-fg-strong transition-colors hover:border-accent/40"
            >
              OpenAPI JSON
            </a>
          </div>
        </motion.header>

        <div className="flex flex-col gap-8">
          {SECCIONES.map((sec) => (
            <Seccion key={sec.titulo} seccion={sec} />
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-fg-muted">
            Política de uso
          </h2>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            Lectura libre sin clave. Rate limit razonable (5 peticiones/min por
            IP en rutas sensibles, 50/min en lectura). Si vas a hacer scraping
            masivo del catálogo, considera{' '}
            <a
              href="https://github.com/diegoalegil/AnimeShowdown"
              target="_blank"
              rel="noreferrer"
              className="text-gold hover:underline"
            >
              clonar el repo
            </a>{' '}
            (licencia MIT) en lugar de pegarle al endpoint público — vive en
            Railway con free tier limitado.
            .
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-fg-muted">
          <Link to="/faq" className="hover:text-gold hover:underline">
            ¿Cómo funciona el ranking?
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/ranking" className="hover:text-gold hover:underline">
            Ver ranking en vivo
          </Link>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/diegoalegil/AnimeShowdown"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gold hover:underline"
          >
            Código fuente en GitHub
          </a>
        </div>
      </div>
    </section>
  )
}

function Seccion({ seccion }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-1 text-lg font-bold text-fg-strong">{seccion.titulo}</h2>
      <p className="mb-4 text-[12px] text-fg-muted">{seccion.descripcion}</p>
      <div className="flex flex-col gap-3">
        {seccion.endpoints.map((ep) => (
          <Endpoint key={ep.path} ep={ep} />
        ))}
      </div>
    </section>
  )
}

function Endpoint({ ep }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
            ep.metodo === 'GET'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-accent/15 text-gold'
          }`}
        >
          {ep.metodo}
        </span>
        <code className="break-all font-mono text-[13px] text-fg-strong">
          {ep.path}
        </code>
      </div>
      <p className="mt-2 text-[12px] text-fg-muted">{ep.desc}</p>
      {ep.ejemplo && (
        <pre className="mt-2 overflow-x-auto rounded-md bg-surface-alt p-2 font-mono text-[11px] text-fg-muted">
          {ep.ejemplo}
        </pre>
      )}
    </div>
  )
}

export default ApiDocsPage
