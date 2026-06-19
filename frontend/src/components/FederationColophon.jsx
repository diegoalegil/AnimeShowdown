import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LEGAL_CONTACT_MAILTO } from '../data/legal'
import './federation-colophon.css'

// ─────────────────────────────────────────────────────────────────────────────
// Rutas REALES del pie de página — mismas claves i18n (nav.*).
// No añadir secciones aquí sin tocar también el footer móvil/sitemap.xml.
// ─────────────────────────────────────────────────────────────────────────────
const productoLinks = [
  { to: '/', i18nKey: 'inicio' },
  { to: '/personajes', i18nKey: 'personajes' },
  { to: '/animes', i18nKey: 'animes' },
  { to: '/descubre-personaje', i18nKey: 'descubrePersonaje' },
  { to: '/torneos', i18nKey: 'torneos' },
  { to: '/eventos', i18nKey: 'eventos' },
  { to: '/votar', i18nKey: 'votar' },
  { to: '/comparar', i18nKey: 'comparar' },
  { to: '/ranking', i18nKey: 'ranking' },
  { to: '/mi-ranking', i18nKey: 'miRanking' },
  { to: '/games', i18nKey: 'games' },
  { to: '/misiones', i18nKey: 'misiones' },
  { to: '/juegos/anime', i18nKey: 'juegosAnime' },
  { to: '/logros', i18nKey: 'logros' },
]

const soporteLinks = [
  { to: '/como-funciona', i18nKey: 'comoFunciona' },
  { to: '/metodologia-elo', i18nKey: 'metodologia' },
  { to: '/faq', i18nKey: 'faq' },
  { to: '/glossary', i18nKey: 'glossary' },
  { to: '/api-docs', i18nKey: 'apiDocs' },
  { to: '/status', i18nKey: 'status' },
]

const legalLinks = [
  { to: '/privacidad', i18nKey: 'footer.privacidad' },
  { to: '/terminos', i18nKey: 'footer.terminos' },
  { to: '/dmca', label: 'DMCA' },
]

/** matchMedia como external store — sin setState síncrono en effects (React Compiler safe). */
function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    [query]
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Grulla de papel plegada: 7 facetas de líneas rectas. Colores en CSS (fc-crane__svg). */
function CraneGlyph() {
  return (
    <svg className="fc-crane__svg" viewBox="0 0 44 30" width="44" height="30" aria-hidden="true">
      <polygon points="1,9 8,7 8,11" className="fc-facet-3" />
      <polygon points="8,7 15,19 8,11" className="fc-facet-1" />
      <polygon points="15,19 24,3 19,18" className="fc-facet-1" />
      <polygon points="17,18 33,1 29,17" className="fc-facet-2" />
      <polygon points="15,19 31,16 23,27" className="fc-facet-2" />
      <polygon points="15,19 23,27 17,25" className="fc-facet-1" />
      <polygon points="31,16 41,9 32,22" className="fc-facet-2" />
    </svg>
  )
}

/** Silueta mínima de torii sobre la línea de horizonte. Decorativo. */
function ToriiGlyph() {
  return (
    <svg className="fc-torii" viewBox="0 0 64 41" width="64" height="41" aria-hidden="true">
      <path d="M5 11 Q32 5 59 11" />
      <line x1="9" y1="15" x2="55" y2="15" />
      <line x1="12" y1="22" x2="52" y2="22" />
      <line x1="16" y1="13.5" x2="14" y2="40.5" />
      <line x1="48" y1="13.5" x2="50" y2="40.5" />
      <line x1="32" y1="15" x2="32" y2="22" />
    </svg>
  )
}

function LinkList({ links, t }) {
  return (
    <div className="fc-links">
      {links.map(({ to, i18nKey }) => (
        <Link key={to} to={to} className="fc-link">
          {t(`nav.${i18nKey}`)}
        </Link>
      ))}
    </div>
  )
}

/**
 * El colofón del recinto — footer editorial global. Sustituye a <Footer />.
 *
 * Coreografía: el sello 戦 se estampa UNA vez al entrar al viewport (300ms,
 * ease-stamp); enlaces con subrayado de tinta al hover (::after scaleX, 150ms,
 * ease-brush); la grulla despega al click (400ms, ease-lift) y aterriza al
 * terminar el scroll. Todo respeta prefers-reduced-motion.
 *
 * @param {object} props
 * @param {string} [props.buildVersion] Versión/commit del build (mono, junto al
 *   copyright). El dato NO existe hoy en el producto: inyectar desde un define de
 *   Vite (p. ej. `define: { __BUILD__: ... }`). Si falta, la línea se omite.
 * @param {import('react').ReactNode} [props.newsletterSlot] Hueco para el
 *   <NewsletterForm /> existente, dentro de la columna Comunidad.
 * @param {import('react').ReactNode} [props.extraSlot] Hueco opcional sobre la
 *   línea de horizonte (p. ej. <FooterTopAnimes /> en las rutas donde hoy aplica).
 */
export default function FederationColophon({ buildVersion, newsletterSlot, extraSlot }) {
  const { t } = useTranslation()
  const rootRef = useRef(null)
  const craneTimers = useRef({ poll: 0, min: 0 })
  const [stamped, setStamped] = useState(false)
  const [flying, setFlying] = useState(false)
  const [openSection, setOpenSection] = useState('')
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const isMobile = useMediaQuery('(max-width: 640px)')

  // Con reduced-motion el sello se muestra ya estampado (CSS), sin IO.
  const showStamped = stamped || prefersReduced

  useEffect(() => {
    if (prefersReduced || stamped) return undefined
    const node = rootRef.current
    if (!node) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStamped(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    io.observe(node)
    return () => io.disconnect()
  }, [prefersReduced, stamped])

  const land = useCallback(() => setFlying(false), [])

  const clearCraneTimers = useCallback(() => {
    window.clearInterval(craneTimers.current.poll)
    window.clearTimeout(craneTimers.current.min)
    window.removeEventListener('scrollend', land)
  }, [land])

  useEffect(() => clearCraneTimers, [clearCraneTimers])

  const handleCrane = () => {
    if (prefersReduced) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    clearCraneTimers()
    setFlying(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', land, { once: true })
      return
    }
    // Safari: sin scrollend — poll de 120ms con vuelo mínimo de 450ms.
    craneTimers.current.min = window.setTimeout(() => {
      let last = window.scrollY
      let still = 0
      craneTimers.current.poll = window.setInterval(() => {
        const y = window.scrollY
        still = y === last ? still + 1 : 0
        if (y <= 0 || still >= 2) {
          window.clearInterval(craneTimers.current.poll)
          land()
        }
        last = y
      }, 120)
    }, 450)
  }

  const sections = [
    {
      key: 'producto',
      title: t('footer.producto'),
      wide: true,
      content: <LinkList links={productoLinks} t={t} />,
    },
    {
      key: 'comunidad',
      title: t('footer.comunidad'),
      content: (
        <div className="fc-links">
          {newsletterSlot}
          <Link to="/apoya" className="fc-link">
            {t('footer.apoyaCta')}
          </Link>
          <a
            href="https://github.com/diegoalegil/AnimeShowdown"
            target="_blank"
            rel="noreferrer"
            className="fc-link"
            title={t('footer.codigoAbiertoTitulo')}
          >
            {t('footer.codigoAbierto')} ↗
          </a>
        </div>
      ),
    },
    {
      key: 'soporte',
      title: t('footer.soporte'),
      content: (
        <div className="fc-links">
          <LinkList links={soporteLinks} t={t} />
          <a href={LEGAL_CONTACT_MAILTO} className="fc-link">
            {t('footer.contacto')}
          </a>
        </div>
      ),
    },
  ]

  return (
    <footer ref={rootRef} className="fc-root">
      {/* Hairline superior con hueco central; el sello vive en una caja
          reservada de 56px → cero CLS al estamparse. */}
      <div className="fc-rule" aria-hidden="true" />
      <div className={showStamped ? 'fc-seal is-stamped' : 'fc-seal'} aria-hidden="true">
        <span className="fc-seal__bleed" />
        <span className="fc-seal__stamp">
          <span className="fc-seal__kanji" lang="ja">
            戦
          </span>
        </span>
      </div>

      {/* Detalle de colofón clásico: texto japonés vertical con significado
          (制作 = producción). Solo desktop (CSS). */}
      <span className="fc-vertical" lang="ja" aria-hidden="true">
        制作・二〇二六
      </span>
      <span className="fc-watermark" lang="ja" aria-hidden="true">
        終
      </span>

      <div className="fc-inner">
        <nav aria-label={t('footer.pieDePagina')} className={isMobile ? 'fc-nav is-stack' : 'fc-nav'}>
          <div className="fc-brand">
            <Link to="/" className="fc-brand__link">
              <span className="fc-brand__name">AnimeShowdown</span>
            </Link>
            <p className="fc-brand__claim">{t('footer.descripcion')}</p>
          </div>

          {sections.map((sec) =>
            isMobile ? (
              <div className="fc-acc" key={sec.key}>
                <button
                  type="button"
                  className="fc-acc__head"
                  aria-expanded={openSection === sec.key}
                  aria-controls={`fc-panel-${sec.key}`}
                  onClick={() => setOpenSection((s) => (s === sec.key ? '' : sec.key))}
                >
                  <span>{sec.title}</span>
                  <span className="fc-acc__mark" aria-hidden="true">
                    ＋
                  </span>
                </button>
                <div
                  id={`fc-panel-${sec.key}`}
                  className="fc-acc__panel"
                  hidden={openSection !== sec.key}
                >
                  {sec.content}
                </div>
              </div>
            ) : (
              <div className={sec.wide ? 'fc-col is-wide' : 'fc-col'} key={sec.key}>
                <h3 className="fc-col__title">{sec.title}</h3>
                <span className="fc-col__tick" aria-hidden="true" />
                {sec.content}
              </div>
            )
          )}
        </nav>

        {extraSlot}

        {/* CTA de conversión heredado del footer clásico: en móvil el header
            lo esconde y este es el único "Votar ahora" de la home (contrato
            del smoke e2e, además de producto). */}
        <div className="mt-10 flex justify-center">
          <Link
            to="/votar"
            className="as-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-black"
          >
            Votar ahora
          </Link>
        </div>

        {/* Línea de horizonte: torii centrado (eje del sello), grulla a la derecha. */}
        <div className="fc-horizon">
          <ToriiGlyph />
          <button
            type="button"
            className="fc-crane"
            aria-label={t('footer.volverArriba')}
            title="Volver arriba"
            onClick={handleCrane}
          >
            <span className={flying ? 'fc-crane__bird is-flying' : 'fc-crane__bird'}>
              <CraneGlyph />
            </span>
          </button>
        </div>

        {/* Colofón de imprenta: legal + copyright + build, centrado. */}
        <div className="fc-colophon">
          <ul className="fc-legal">
            {legalLinks.map(({ to, i18nKey, label }) => (
              <li key={to}>
                <Link to={to} className="fc-legal__link">
                  {label ?? t(i18nKey)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="fc-copy">
            {t('footer.copyright')} · {t('footer.origen')}
          </p>
          {buildVersion ? <p className="fc-build">{buildVersion}</p> : null}
        </div>
      </div>
    </footer>
  )
}
