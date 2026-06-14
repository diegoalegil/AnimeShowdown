import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { breadcrumbsSchema } from '../lib/schema'
import JsonLd from '../components/JsonLd'
import { tokenizeJson } from '../lib/jsonTokens'
import './api-blueprints.css'

/**
 * Página pública /api-docs — «Los planos del API».
 *
 * Reskin tipo documento técnico estilo blueprint montado EN SU SITIO:
 * misma ruta, mismo SEO, mismo contenido. La lista de endpoints se mantiene a
 * mano (en lugar de auto-generarla del OpenAPI) porque está curada para
 * humanos — descripción, ejemplo de respuesta. El Swagger UI del backend
 * sigue siendo la fuente de verdad para developers estrictos.
 *
 * Sirve a dos públicos:
 *  - Devs que quieren consumir la API sin auth (catálogo, ranking).
 *  - Quien quiera ver el OpenAPI completo en el Swagger UI del backend.
 *
 * Coreografía (y nada más):
 *  - expandir endpoint: grid-template-rows 0fr→1fr · 240ms · var(--ease-lift)
 *  - copiar: subrayado de tinta scaleX 400ms var(--ease-brush) + «copiado» 2 s
 */

/* Numerales canónicos del subset (一…十) — índice editorial de recursos.
   印 (sello) en el hero. Ambos ya en el manifest de fuentes. */
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

const METHOD_CLASS = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'delete' }

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')

const endpointId = (ep) => ep.metodo + ' ' + ep.path

/**
 * Endpoints REST públicos de AnimeShowdown, agrupados por recurso. Datos REALES:
 * método, ruta, descripción y ejemplo de respuesta de cada operación. No se
 * inventa nada — es el contenido de la doc y debe ser crawlable como texto.
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
        desc: 'Lista personajes paginados por defecto. Usa page, size y anime; size se limita para evitar respuestas masivas.',
        ejemplo:
          '{ "content": [{ "id": 1, "slug": "akame", "nombre": "Akame" }], "size": 50, "number": 0, "totalElements": 1086 }',
      },
      {
        metodo: 'GET',
        path: '/api/personajes/catalogo',
        desc: 'Catálogo compacto para clientes que necesitan todos los slugs/campos ligeros con ETag y CDN cache.',
        ejemplo:
          '[{ "id": 1, "slug": "akame", "nombre": "Akame", "anime": "Akame ga Kill!", "imagenUrl": "/img/Akame_ga_Kill/akame.webp" }, ...]',
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
    descripcion:
      'Catálogo público de 17 logros base con rareza 1-5; los perfiles pueden sumar logros derivados.',
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
    descripcion:
      'Disponibilidad pública calculada desde muestras persistidas del healthcheck backend.',
    endpoints: [
      {
        metodo: 'GET',
        path: '/api/status',
        desc: 'Uptime y latencia agregados para 24h, 7d, 30d y 90d. Cache-Control: no-store.',
      },
      {
        metodo: 'GET',
        path: '/actuator/health',
        desc: 'Healthcheck público de infraestructura. No forma parte del OpenAPI, pero es la comprobación directa de disponibilidad.',
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
        path: '/api/og/duelo/{slugA}/vs/{slugB}.png',
        desc: 'OG image 1200x630 para compartir un duelo personaje contra personaje.',
      },
      {
        metodo: 'GET',
        path: '/api/og/pvp.png',
        desc: 'OG image 1200x630 para el modo duelo PvP live.',
      },
    ],
  },
]

/** Último recurso de copia (clipboard denegado / Safari antiguo). */
function legacyCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* sin soporte: el announce sigue vivo */
  }
  document.body.removeChild(ta)
}

/**
 * Sello de método HTTP. Lleva SIEMPRE el texto del método y varía también
 * el relleno/trazo (liso, sólido, discontinuo): distinguible sin color.
 */
function MethodSeal({ method }) {
  const m = String(method || 'GET').toUpperCase()
  return <span className={'apibp-seal apibp-seal--' + (METHOD_CLASS[m] || 'get')}>{m}</span>
}

/** Ruta en mono; los segmentos {param} van en oro. */
function RoutePath({ path, className }) {
  const parts = String(path).split(/(\{[^}]+\})/g)
  return (
    <code className={'apibp-route' + (className ? ' ' + className : '')}>
      {parts.map((p, i) =>
        p.charAt(0) === '{' ? (
          <span key={i} className="apibp-route-param">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </code>
  )
}

/**
 * Panel de papel con el ejemplo de respuesta y botón copiar.
 * Copiar: subrayado de tinta 400ms var(--ease-brush) + «copiado» 2 s +
 * announce con role="status". El subrayado se remonta con key={inkRun}
 * para que el replay reinicie la animación.
 */
function ResponsePanel({ example, path }) {
  const [copied, setCopied] = useState(false)
  const [inkRun, setInkRun] = useState(0)
  const timerRef = useRef(null)

  // Cancela el timer de "copiado" al desmontar (si se navega antes de los 2s,
  // evita setState sobre un componente ya desmontado).
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleCopy = () => {
    const finish = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setCopied(true)
      setInkRun((n) => n + 1)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(example).then(finish, () => {
        legacyCopy(example)
        finish()
      })
    } else {
      legacyCopy(example)
      finish()
    }
  }

  return (
    <figure className="apibp-paper">
      <figcaption className="apibp-paper-head">
        <span className="apibp-paper-label">respuesta · 200</span>
        <button
          type="button"
          className="apibp-copy"
          data-copied={copied ? '' : undefined}
          onClick={handleCopy}
          aria-label={'Copiar ejemplo de respuesta para ' + path}
        >
          {copied ? 'copiado' : 'copiar'}
          <span key={inkRun} className="apibp-copy-ink" aria-hidden="true"></span>
        </button>
      </figcaption>
      <pre
        className="apibp-pre"
        tabIndex={0}
        aria-label={'Ejemplo de respuesta para ' + path}
      >
        <code>
          {tokenizeJson(example).map((t, i) =>
            t.type === 'plain' ? (
              t.text
            ) : (
              <span key={i} className={'apibp-tk-' + t.type}>
                {t.text}
              </span>
            ),
          )}
        </code>
      </pre>
      <span className="apibp-visually-hidden" role="status" aria-live="polite">
        {copied ? 'Ejemplo copiado al portapapeles' : ''}
      </span>
    </figure>
  )
}

/**
 * Fila-acordeón de un endpoint (ARIA: h3>button[aria-expanded][aria-controls]
 * + region). Despliegue: grid-rows 0fr→1fr 240ms var(--ease-lift). El summary
 * (método + ruta + descripción) es texto SIEMPRE en el DOM — crawlable.
 */
function EndpointRow({ endpoint, open, onToggle, htmlId }) {
  const btnId = htmlId + '-btn'
  const panelId = htmlId + '-panel'
  return (
    <li className="apibp-endpoint" data-open={open ? '' : undefined}>
      <h3 className="apibp-endpoint-h">
        <button
          type="button"
          id={btnId}
          className="apibp-endpoint-btn"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <MethodSeal method={endpoint.metodo} />
          <RoutePath path={endpoint.path} />
          <span className="apibp-chevron" aria-hidden="true"></span>
          {endpoint.desc ? <span className="apibp-ep-summary">{endpoint.desc}</span> : null}
        </button>
      </h3>
      <div
        id={panelId}
        className="apibp-expand"
        role="region"
        aria-labelledby={btnId}
        data-open={open ? '' : undefined}
      >
        <div className="apibp-expand-inner">
          <div className="apibp-detail">
            <div className="apibp-plate">
              <span className="apibp-plate-method">{endpoint.metodo}</span>
              <RoutePath path={endpoint.path} className="apibp-plate-route" />
            </div>
            <p className="apibp-desc">{endpoint.desc}</p>
            {endpoint.ejemplo ? (
              <ResponsePanel example={endpoint.ejemplo} path={endpoint.path} />
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}

/** Sección de recurso: numeral kanji + nombre + descripción + acordeones. */
function ResourceSection({ seccion, index, idBase, openIds, onToggle }) {
  const hid = idBase + '-h'
  return (
    <section className="apibp-resource" aria-labelledby={hid}>
      <header className="apibp-resource-head">
        <span className="apibp-resource-num" aria-hidden="true">
          {KANJI_NUM[index] || ''}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={hid} className="apibp-resource-name">
            {seccion.titulo}
          </h2>
          {seccion.descripcion ? (
            <p className="apibp-resource-desc">{seccion.descripcion}</p>
          ) : null}
        </div>
        <span className="apibp-resource-count font-mono shrink-0">
          {seccion.endpoints.length} endpoints
        </span>
      </header>
      <ul className="apibp-endpoints">
        {seccion.endpoints.map((ep) => {
          const epId = endpointId(ep)
          return (
            <EndpointRow
              key={epId}
              endpoint={ep}
              htmlId={idBase + '-' + slugify(epId)}
              open={openIds.has(epId)}
              onToggle={() => onToggle(epId)}
            />
          )
        })}
      </ul>
    </section>
  )
}

function ApiDocsPage() {
  useSeo({
    title: 'API pública',
    description:
      'Endpoints REST públicos de AnimeShowdown: catálogo de personajes, ranking competitivo, torneos, perfiles, predicciones, OG images. Sin auth para lectura.',
  })

  const uid = useId()
  const [openIds, setOpenIds] = useState(() => new Set())

  const handleToggle = (epId) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(epId)) next.delete(epId)
      else next.add(epId)
      return next
    })
  }

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <JsonLd
        id="breadcrumbs"
        schema={breadcrumbsSchema([
          { label: 'Inicio', path: '/' },
          { label: 'API docs', path: '/api-docs' },
        ])}
      />
      <div className="apibp mx-auto max-w-3xl" data-variant="docs">
        <header className="apibp-hero">
          <span className="apibp-hero-kanji" aria-hidden="true">
            印
          </span>
          <p className="apibp-eyebrow">animeshowdown · api · sala de planos</p>
          <h1 className="apibp-title">Endpoints REST</h1>
          <p className="apibp-intro">
            AnimeShowdown expone una API REST pública para lectura del catálogo de
            personajes, ranking competitivo, torneos y perfiles. Sin auth para los
            endpoints de abajo. La raíz{' '}
            <code className="apibp-route">https://api.animeshowdown.dev/</code> es la base
            técnica y puede responder 403; las entradas navegables son Swagger, OpenAPI
            JSON y healthcheck.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="https://api.animeshowdown.dev/swagger-ui/index.html"
              target="_blank"
              rel="noreferrer"
              className="apibp-cover-cta"
            >
              referencia completa · Swagger <span aria-hidden="true">→</span>
            </a>
            <a
              href="https://api.animeshowdown.dev/v3/api-docs"
              target="_blank"
              rel="noreferrer"
              className="apibp-cover-cta"
            >
              OpenAPI JSON
            </a>
            <a
              href="https://api.animeshowdown.dev/actuator/health"
              target="_blank"
              rel="noreferrer"
              className="apibp-cover-cta"
            >
              Healthcheck
            </a>
          </div>
          <hr className="apibp-hairline" />
        </header>

        {SECCIONES.map((sec, i) => (
          <ResourceSection
            key={sec.titulo}
            seccion={sec}
            index={i}
            idBase={uid + '-' + slugify(sec.titulo)}
            openIds={openIds}
            onToggle={handleToggle}
          />
        ))}

        <section className="apibp-resource" aria-label="Política de uso">
          <header className="apibp-resource-head">
            <h2 className="apibp-resource-name">Política de uso</h2>
          </header>
          <p className="apibp-desc">
            Lectura libre sin clave. Rate limit razonable (5 peticiones/min por IP en
            rutas sensibles, 50/min en lectura). Si vas a hacer scraping masivo del
            catálogo, considera{' '}
            <a
              href="https://github.com/diegoalegil/AnimeShowdown"
              target="_blank"
              rel="noreferrer"
              className="text-gold underline decoration-gold/60 underline-offset-2 hover:text-fg-strong"
            >
              clonar el repo
            </a>{' '}
            (licencia MIT) en lugar de consumir el endpoint público de forma intensiva. La
            infraestructura está dimensionada para uso interactivo y lectura moderada.
          </p>
        </section>

        <div className="apibp-footer-links mt-8 flex flex-wrap gap-3 text-[13px] text-fg-muted">
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

export default ApiDocsPage
