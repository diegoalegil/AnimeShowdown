import { Suspense, useEffect, useLayoutEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Header from './components/Header'
import FooterSlim from './components/FooterSlim'
import FederationColophon from './components/FederationColophon'
import FooterTopAnimes from './components/FooterTopAnimes'
import NewsletterForm from './components/NewsletterForm'
import ErrorBoundary from './components/ErrorBoundary'
import ScrollProgress from './components/ScrollProgress'
import CommandPaletteLazyMount from './components/CommandPaletteLazyMount'
import EmailVerifyBanner from './components/EmailVerifyBanner'
import BadgeUnlockListener from './components/BadgeUnlockListener'
import PushSubscriptionSync from './components/PushSubscriptionSync'
import OnboardingGate from './components/onboarding/OnboardingGate'
import FirstDuelTourGate from './features/onboarding/FirstDuelTourGate'
import CookieConsent from './components/CookieConsent'
import SeasonalLayer from './components/SeasonalLayer'
import KonamiCode from './components/KonamiCode'
import MobileBottomNav from './components/MobileBottomNav'
import RequireCatalog from './components/RequireCatalog'
import PageSkeleton from './components/PageSkeleton'
import { useCatalogoPersonajes } from './hooks/useCatalogoPersonajes'
import { shouldGateCatalogRoute, shouldPrimeCatalog } from './lib/catalog-route-policy'
import { lazyRoute } from './lib/lazyRoute'
import { getRouteSkeletonReserve } from './lib/routeSkeletonPolicy'
import { canWarmupRoutes, idleWarmupRoutesFor } from './lib/route-warmup-policy'
import { recoverFromStaleAssetError } from './lib/staleAssetRecovery'
import { settleNavigationViewTransition } from './lib/viewTransitions'
import i18n from './lib/i18n'
import { useCalmMode } from './hooks/useCalmMode'

// Estático: tokens CSS + labels fijos. A nivel de módulo para no recrear el
// objeto (ni su style anidado) en cada render de App.
const TOAST_OPTIONS = {
  closeButtonAriaLabel: 'Cerrar notificacion',
  style: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-fg-strong)',
  },
}

// Todas las rutas, incluida home, van detrás de React.lazy. InicioPage
// importa el catálogo estático y varias secciones visuales pesadas; si se
// queda en el bundle raíz, cualquier ruta paga ese coste antes de pintar.
const routePreloaders = {
  inicio: () => import('./pages/InicioPage'),
  personajes: () => import('./pages/PersonajesPage'),
  personajeDetail: () => import('./pages/PersonajeDetailPage'),
  animes: () => import('./pages/AnimesPage'),
  animeDetail: () => import('./pages/AnimeDetailPage'),
  animeRanking: () => import('./pages/AnimeRankingPage'),
  editorialRanking: () => import('./pages/EditorialRankingPage'),
  torneos: () => import('./pages/TorneosPage'),
  torneoDetail: () => import('./pages/TorneoDetailPage'),
  ranking: () => import('./pages/RankingPage'),
  fantasy: () => import('./pages/FantasyPage'),
  votar: () => import('./pages/VotarPage'),
  games: () => import('./pages/GamesHubPage'),
  shadowGuess: () => import('./pages/GuessCharacterPage'),
  animeReveal: () => import('./pages/GuessAnimePage'),
  oraculo: () => import('./pages/OraculoPage'),
  anigrid: () => import('./pages/AnidelPage'),
  nexoAnime: () => import('./pages/NexoAnimePage'),
  impostor: () => import('./pages/ImpostorPage'),
  eloDuel: () => import('./pages/HigherOrLowerPage'),
  ruleta: () => import('./pages/RuletaPage'),
  perfil: () => import('./pages/PerfilPage'),
  logros: () => import('./pages/LogrosPage'),
  feed: () => import('./pages/FeedPage'),
  cartas: () => import('./pages/CartasPage'),
  tierLists: () => import('./pages/TierListsPage'),
  wrapped: () => import('./pages/WrappedPage'),
  wrappedPublico: () => import('./pages/WrappedPublicPage'),
}

const InicioPage = lazyRoute(routePreloaders.inicio)
const PersonajesPage = lazyRoute(routePreloaders.personajes)
const PersonajeDetailPage = lazyRoute(routePreloaders.personajeDetail)
const AnimesPage = lazyRoute(routePreloaders.animes)
const ConstelacionAnimesPage = lazyRoute(() => import('./pages/ConstelacionAnimesPage'))
const AnimeDetailPage = lazyRoute(routePreloaders.animeDetail)
const AnimeRankingPage = lazyRoute(routePreloaders.animeRanking)
const EditorialRankingPage = lazyRoute(routePreloaders.editorialRanking)
const TorneosPage = lazyRoute(routePreloaders.torneos)
const TorneoDetailPage = lazyRoute(routePreloaders.torneoDetail)
const EventosIndexPage = lazyRoute(() => import('./pages/EventosIndexPage'))
const EventoDetailPage = lazyRoute(() => import('./pages/EventoDetailPage'))
const DueloVersusPage = lazyRoute(() => import('./pages/DueloVersusPage'))
const CompararPage = lazyRoute(() => import('./pages/CompararPage'))
const RankingPage = lazyRoute(routePreloaders.ranking)
const FantasyPage = lazyRoute(routePreloaders.fantasy)
const HigherOrLowerPage = lazyRoute(routePreloaders.eloDuel)
const RuletaPage = lazyRoute(routePreloaders.ruleta)
const VotarPage = lazyRoute(routePreloaders.votar)
const DueloLivePage = lazyRoute(() => import('./pages/DueloLivePage'))
const LoginPage = lazyRoute(() => import('./pages/LoginPage'))
const RegisterPage = lazyRoute(() => import('./pages/RegisterPage'))
const AuthCallbackPage = lazyRoute(() => import('./pages/AuthCallbackPage'))
const ForgotPasswordPage = lazyRoute(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazyRoute(() => import('./pages/ResetPasswordPage'))
const AdminPage = lazyRoute(() => import('./pages/AdminPage'))
const PerfilPage = lazyRoute(routePreloaders.perfil)
const WrappedPage = lazyRoute(routePreloaders.wrapped)
const WrappedPublicPage = lazyRoute(routePreloaders.wrappedPublico)
const FeedPage = lazyRoute(routePreloaders.feed)
const CartasPage = lazyRoute(routePreloaders.cartas)
const EspecialesPage = lazyRoute(() => import('./pages/EspecialesPage'))
const TierListsPage = lazyRoute(routePreloaders.tierLists)
const UsuarioPage = lazyRoute(() => import('./pages/UsuarioPage'))
const UsuarioLogrosPage = lazyRoute(() => import('./pages/UsuarioLogrosPage'))
const CrearTorneoPage = lazyRoute(() => import('./pages/CrearTorneoPage'))
const FaqPage = lazyRoute(() => import('./pages/FaqPage'))
const ApiDocsPage = lazyRoute(() => import('./pages/ApiDocsPage'))
const StatusPage = lazyRoute(() => import('./pages/StatusPage'))
const ComoFuncionaPage = lazyRoute(() => import('./pages/ComoFuncionaPage'))
const MetodologiaEloPage = lazyRoute(() => import('./pages/MetodologiaEloPage'))
const JuegosAnimePage = lazyRoute(() => import('./pages/JuegosAnimePage'))
const MisionesPage = lazyRoute(() => import('./pages/MisionesPage'))
const DescubrePersonajePage = lazyRoute(() => import('./pages/DescubrePersonajePage'))
const MiRankingPage = lazyRoute(() => import('./pages/MiRankingPage'))
const GamesHubPage = lazyRoute(routePreloaders.games)
const GuessCharacterPage = lazyRoute(routePreloaders.shadowGuess)
const GuessAnimePage = lazyRoute(routePreloaders.animeReveal)
const OraculoPage = lazyRoute(routePreloaders.oraculo)
const AnidelPage = lazyRoute(routePreloaders.anigrid)
const NexoAnimePage = lazyRoute(routePreloaders.nexoAnime)
const ImpostorPage = lazyRoute(routePreloaders.impostor)
const OmikujiPage = lazyRoute(() => import('./pages/OmikujiPage'))
const GlossaryPage = lazyRoute(() => import('./pages/GlossaryPage'))
const LogrosPage = lazyRoute(routePreloaders.logros)
const ApoyaPage = lazyRoute(() => import('./pages/ApoyaPage'))
const PrivacyPage = lazyRoute(() => import('./pages/PrivacyPage'))
const TermsPage = lazyRoute(() => import('./pages/TermsPage'))
const DmcaPage = lazyRoute(() => import('./pages/DmcaPage'))
const TvModePage = lazyRoute(() => import('./pages/TvModePage'))
const MiTop5Page = lazyRoute(() => import('./pages/MiTop5Page'))
const LeaderboardsPage = lazyRoute(() => import('./pages/LeaderboardsPage'))
const VerifyPage = lazyRoute(() => import('./pages/VerifyPage'))
const NewsletterConfirmarPage = lazyRoute(() => import('./pages/NewsletterConfirmarPage'))
const NotFoundPage = lazyRoute(() => import('./pages/NotFoundPage'))
const Splash = lazyRoute(() => import('./components/Splash'))

const preloadedImporters = new Set()
const ROUTE_WARMUP_DELAY_MS = 4000
const ROUTE_WARMUP_GAP_MS = 900
const SUPPORTED_ROUTE_LANGS = new Set(['es', 'en', 'ja'])

function routePreloaderFor(pathname) {
  if (pathname === '/') return routePreloaders.inicio
  if (pathname === '/personajes') return routePreloaders.personajes
  if (pathname.startsWith('/personajes/')) return routePreloaders.personajeDetail
  if (pathname === '/animes') return routePreloaders.animes
  if (pathname.startsWith('/animes/') && pathname.endsWith('/ranking')) return routePreloaders.animeRanking
  if (pathname.startsWith('/animes/')) return routePreloaders.animeDetail
  if (pathname === '/torneos') return routePreloaders.torneos
  if (pathname.startsWith('/torneos/')) return routePreloaders.torneoDetail
  if (pathname === '/ranking') return routePreloaders.ranking
  if (pathname === '/fantasy') return routePreloaders.fantasy
  if (pathname.startsWith('/rankings/')) return routePreloaders.editorialRanking
  if (pathname === '/votar') return routePreloaders.votar
  if (pathname === '/games') return routePreloaders.games
  if (pathname === '/games/shadow-guess') return routePreloaders.shadowGuess
  if (pathname === '/games/anime-reveal') return routePreloaders.animeReveal
  if (pathname === '/games/oraculo') return routePreloaders.oraculo
  if (pathname === '/games/anigrid') return routePreloaders.anigrid
  if (pathname === '/games/nexo-anime') return routePreloaders.nexoAnime
  if (pathname === '/games/impostor-trial') return routePreloaders.impostor
  if (pathname === '/games/elo-duel') return routePreloaders.eloDuel
  if (pathname === '/games/ruleta') return routePreloaders.ruleta
  if (pathname === '/higher-or-lower') return routePreloaders.eloDuel
  if (pathname === '/perfil') return routePreloaders.perfil
  if (pathname === '/feed') return routePreloaders.feed
  if (pathname === '/logros') return routePreloaders.logros
  if (pathname === '/tier-lists' || pathname.startsWith('/tier-lists/')) return routePreloaders.tierLists
  return null
}

function preloadRoute(pathname) {
  const importer = routePreloaderFor(pathname)
  if (!importer || preloadedImporters.has(importer)) return
  preloadedImporters.add(importer)
  importer().catch((error) => {
    preloadedImporters.delete(importer)
    recoverFromStaleAssetError(error)
  })
}

function scheduleIdle(callback, timeout = 3000) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout })
    return () => window.cancelIdleCallback?.(id)
  }

  const id = window.setTimeout(callback, 0)
  return () => window.clearTimeout(id)
}

function normalizeRouteLanguage(value) {
  const base = value?.toLowerCase?.().split('-')[0]
  return SUPPORTED_ROUTE_LANGS.has(base) ? base : null
}

function useQueryLanguageSync(search) {
  useEffect(() => {
    const applyDocumentLang = (value) => {
      document.documentElement.lang = normalizeRouteLanguage(value) ?? 'es'
    }

    applyDocumentLang(i18n.resolvedLanguage || i18n.language)
    i18n.on('languageChanged', applyDocumentLang)

    return () => {
      i18n.off('languageChanged', applyDocumentLang)
    }
  }, [])

  useEffect(() => {
    const requestedLang = normalizeRouteLanguage(new URLSearchParams(search).get('lang'))
    if (!requestedLang) return

    const currentLang = normalizeRouteLanguage(i18n.resolvedLanguage || i18n.language)
    if (currentLang === requestedLang) return

    i18n.changeLanguage(requestedLang).catch(() => {})
  }, [search])
}

// EN-first SEO: las rutas /en/* están prerenderizadas en inglés (meta + hreflang)
// para captar búsqueda anglófona. Al cargarlas en el SPA forzamos el shell a EN
// para que el contenido no contradiga la meta indexada. El resto de rutas respeta
// la elección del usuario (localStorage / ?lang); como i18next persiste el idioma,
// navegar de una /en/* a una ruta normal mantiene el inglés.
function usePathLanguageSync(pathname) {
  useEffect(() => {
    if (pathname !== '/en' && !pathname.startsWith('/en/')) return
    const current = normalizeRouteLanguage(i18n.resolvedLanguage || i18n.language)
    if (current === 'en') return
    i18n.changeLanguage('en').catch(() => {})
  }, [pathname])
}

function App() {
  const location = useLocation()
  const { calm } = useCalmMode()
  // En rutas sin personajes (auth/legal) NO cebamos el catálogo global (~170KB):
  // ahí App.jsx es su único observer, así que el gate aquí evita el fetch.
  const catalogoQuery = useCatalogoPersonajes({
    enabled: shouldPrimeCatalog(location.pathname),
  })
  useQueryLanguageSync(location.search)
  usePathLanguageSync(location.pathname)
  // Rutas fullscreen sin chrome global (TV mode, etc.). Si el usuario
  // navega aquí queremos que el viewport sea solo del contenido — sin
  // header global, sin bottom nav móvil, sin footer.
  const isFullscreenRoute = location.pathname.startsWith('/tv')
  const routeSkeletonReserve = getRouteSkeletonReserve(location.pathname)
  // Helper local para no repetir el wrapper en cada ruta que sí necesita
  // catálogo antes de pintar.
  const gated = (element) => (
    <RequireCatalog
      catalogoQuery={catalogoQuery}
      loadingPathname={location.pathname}
      loadingReserveClassName={routeSkeletonReserve}
    >
      {element}
    </RequireCatalog>
  )
  const catalogAware = (element) =>
    shouldGateCatalogRoute(location.pathname) ? gated(element) : element

  // Scroll to top en cada cambio de ruta — antes la página quedaba con el scroll
  // de la página anterior, así que al click en una card del catálogo el detalle
  // aparecía "desde abajo" (porque el navegador conserva la posición y el
  // contenido nuevo es más corto que el scroll heredado).
  //
  // Layout effect (no effect) a propósito: este commit es el que espera la
  // view transition de la navegación. El reset de scroll ocurre antes de
  // pintar y DENTRO de la transición, y el settle libera la captura del
  // estado nuevo ya arriba del todo. Sin transición pendiente es un no-op.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    settleNavigationViewTransition()
  }, [location.pathname])

  useEffect(() => {
    const root = document.documentElement
    const syncVisibilityClass = () => {
      root.classList.toggle('as-tab-hidden', document.visibilityState === 'hidden')
    }

    syncVisibilityClass()
    document.addEventListener('visibilitychange', syncVisibilityClass)
    return () => {
      document.removeEventListener('visibilitychange', syncVisibilityClass)
      root.classList.remove('as-tab-hidden')
    }
  }, [])

  useEffect(() => {
    const preloadFromLink = (event) => {
      const link = event.target?.closest?.('a[href]')
      if (!link) return
      let url
      try {
        url = new URL(link.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      preloadRoute(url.pathname)
    }

    document.addEventListener('pointerover', preloadFromLink, { capture: true, passive: true })
    document.addEventListener('focusin', preloadFromLink, true)
    return () => {
      document.removeEventListener('pointerover', preloadFromLink, true)
      document.removeEventListener('focusin', preloadFromLink, true)
    }
  }, [])

  useEffect(() => {
    if (!canWarmupRoutes()) return undefined
    const warmupRoutes = idleWarmupRoutesFor(location.pathname)
    if (warmupRoutes.length === 0) return undefined

    let cancelled = false
    let routeIndex = 0
    let delayId = 0
    let cancelIdle = () => {}

    const queueNextRoute = () => {
      if (cancelled || routeIndex >= warmupRoutes.length) return
      preloadRoute(warmupRoutes[routeIndex])
      routeIndex += 1

      delayId = window.setTimeout(() => {
        cancelIdle = scheduleIdle(queueNextRoute)
      }, ROUTE_WARMUP_GAP_MS)
    }

    const startRouteWarmup = () => {
      delayId = window.setTimeout(() => {
        cancelIdle = scheduleIdle(queueNextRoute, 4000)
      }, ROUTE_WARMUP_DELAY_MS)
    }

    if (document.readyState === 'complete') {
      startRouteWarmup()
    } else {
      window.addEventListener('load', startRouteWarmup, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener('load', startRouteWarmup)
      window.clearTimeout(delayId)
      cancelIdle()
    }
  }, [location.pathname])

  return (
    // MotionConfig alinea el useReducedMotion de framer con el modo calma:
    // los gates JS propios ya lo ven vía useReducedMotionPref (unión).
    <MotionConfig reducedMotion={calm ? 'always' : 'user'}>
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-fg-strong focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold"
      >
        Saltar al contenido
      </a>
      <Suspense fallback={null}>
        <Splash />
      </Suspense>
      <ScrollProgress />
      <CommandPaletteLazyMount />
      <Toaster
        position="top-right"
        theme="dark"
        containerAriaLabel="Notificaciones de AnimeShowdown"
        toastOptions={TOAST_OPTIONS}
      />
      {/* /tv tiene chrome propio fullscreen. Omitimos header, footer y
          bottom nav global para no montar DOM visual duplicado. */}
      {!isFullscreenRoute && <Header />}
      {/* Listener global de unlock: side-effect-only, sin UI. Se monta
          siempre — internamente skipea cuando no hay user logueado. */}
      <BadgeUnlockListener />
      {/* Mantiene la suscripción de web push atada al backend: resync al
          arrancar + reacción al pushsubscriptionchange del SW. Side-effect-only,
          skipea sin user, sin soporte push o sin permiso concedido. */}
      <PushSubscriptionSync />
      {/* Combate guiado de primera visita: null para todo el mundo salvo el
          candidato (autenticado + gate ausente + primer /votar); el chunk
          del tour solo se carga entonces. Distinto del OnboardingGate de
          username/avatar (V-8): aquel es el alta, este es el primer combate. */}
      <FirstDuelTourGate />
      {/* Capas estacionales (hanami, Tanabata, …): registro data-driven con
          gate por fechas/rutas y kill-switches en seasonal-events.js. Las
          capas nuevas cargan lazy — 0 bytes fuera de su ventana. */}
      <SeasonalLayer />
      {/* Easter egg ↑↑↓↓←→←→BA. */}
      <KonamiCode />
      {/* V-8: tras el primer login OAuth (username autogenerado) abre el
          modal de onboarding una vez. Internamente skipea si no hace falta. */}
      <OnboardingGate />
      <CookieConsent />
      <EmailVerifyBanner />
      <main id="main-content" tabIndex={-1} className="flex min-h-[calc(100svh-var(--as-header-h))] flex-1 flex-col focus:outline-none">
        <div className="flex flex-1 flex-col">
          {/* Boundary a nivel de ruta. Un error de render en una página se
              contiene aquí y el shell (Header, Footer, nav) sigue vivo, en
              vez de tumbar toda la app contra el boundary raíz de main.jsx.
              resetKey limpia el fallback solo si hubo error; la navegación
              normal no remonta el subárbol ni borra estado local de página. */}
          <ErrorBoundary resetKey={location.pathname}>
          <Suspense
            fallback={(
              <PageSkeleton
                pathname={location.pathname}
                reserveClassName={routeSkeletonReserve}
              />
            )}
          >
            <Routes location={location}>
              {/* ===== Rutas INDEPENDIENTES del catálogo ===== */}
              {/* Auth, soporte, legal y status. Estas páginas tienen que
                  funcionar aunque /api/personajes/catalogo esté caído —
                  son las que el usuario usa para diagnosticar incidentes,
                  recuperar contraseña, leer términos o cerrar sesión. */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/newsletter/confirmar" element={<NewsletterConfirmarPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/como-funciona" element={<ComoFuncionaPage />} />
              <Route path="/metodologia-elo" element={<MetodologiaEloPage />} />
              <Route path="/juegos/anime" element={<JuegosAnimePage />} />
              <Route path="/mision-diaria" element={<Navigate replace to="/misiones" />} />
              <Route path="/misiones" element={<MisionesPage />} />
              <Route path="/mi-ranking" element={<MiRankingPage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/apoya" element={<ApoyaPage />} />
              <Route path="/privacy" element={<Navigate replace to="/privacidad" />} />
              <Route path="/terms" element={<Navigate replace to="/terminos" />} />
              <Route path="/privacidad" element={<PrivacyPage />} />
              <Route path="/terminos" element={<TermsPage />} />
              <Route path="/dmca" element={<DmcaPage />} />
              <Route path="/glosario" element={<Navigate replace to="/glossary" />} />
              <Route path="/glossary" element={<GlossaryPage />} />

              {/* ===== Rutas catalog-aware ===== */}
              {/* Por defecto pasan por <RequireCatalog>. Las rutas críticas de
                  navegación caliente se dejan pintar y cargan el catálogo en
                  background; cada página gestiona su skeleton o fallback local. */}
              <Route path="/" element={catalogAware(<InicioPage />)} />
              {/* EN-first (SEO): /en/* están prerenderizadas en inglés (meta +
                  hreflang) para captar búsqueda anglófona. Renderizan la MISMA
                  página con el shell forzado a EN (usePathLanguageSync). Las 8
                  money pages = EN_COPY en scripts/prerender-seo.mjs. */}
              <Route path="/en" element={catalogAware(<InicioPage />)} />
              <Route path="/en/personajes" element={catalogAware(<PersonajesPage />)} />
              <Route path="/en/animes" element={catalogAware(<AnimesPage />)} />
              <Route path="/en/comparar" element={catalogAware(<CompararPage />)} />
              <Route path="/en/ranking" element={catalogAware(<RankingPage />)} />
              <Route path="/en/votar" element={catalogAware(<VotarPage />)} />
              <Route path="/en/games" element={catalogAware(<GamesHubPage />)} />
              <Route path="/en/juegos/anime" element={<JuegosAnimePage />} />
              <Route path="/personajes" element={catalogAware(<PersonajesPage />)} />
              <Route path="/personajes/:slug" element={catalogAware(<PersonajeDetailPage />)} />
              <Route path="/animes" element={catalogAware(<AnimesPage />)} />
              <Route path="/animes/constelacion" element={catalogAware(<ConstelacionAnimesPage />)} />
              <Route path="/animes/:slug/ranking" element={catalogAware(<AnimeRankingPage />)} />
              <Route path="/animes/:slug" element={catalogAware(<AnimeDetailPage />)} />
              <Route path="/torneos" element={catalogAware(<TorneosPage />)} />
              <Route path="/torneos/crear" element={catalogAware(<CrearTorneoPage />)} />
              <Route path="/torneos/:slug" element={catalogAware(<TorneoDetailPage />)} />
              <Route path="/eventos" element={catalogAware(<EventosIndexPage />)} />
              <Route path="/eventos/:slug" element={catalogAware(<EventoDetailPage />)} />
              <Route path="/versus/:par" element={catalogAware(<DueloVersusPage />)} />
              <Route path="/duelos/:par" element={catalogAware(<DueloVersusPage />)} />
              <Route path="/versus" element={<Navigate replace to="/comparar" />} />
              <Route path="/compare" element={<Navigate replace to="/comparar" />} />
              <Route path="/comparar" element={catalogAware(<CompararPage />)} />
              <Route path="/ranking" element={catalogAware(<RankingPage />)} />
              <Route path="/fantasy" element={catalogAware(<FantasyPage />)} />
              <Route path="/rankings/:slug" element={catalogAware(<EditorialRankingPage />)} />
              <Route path="/descubre-personaje" element={catalogAware(<DescubrePersonajePage />)} />
              <Route path="/random" element={<Navigate replace to="/descubre-personaje" />} />
              {/* Higher or Lower → ELO Duel. La ruta vieja redirige
                  client-side; _redirects emite 301 a nivel CDN. */}
              <Route
                path="/higher-or-lower"
                element={<Navigate replace to="/games/elo-duel" />}
              />
              <Route path="/votar" element={catalogAware(<VotarPage />)} />
              <Route path="/duel-live" element={catalogAware(<DueloLivePage />)} />
              <Route path="/admin" element={catalogAware(<AdminPage />)} />
              <Route path="/admin/torneos" element={catalogAware(<AdminPage />)} />
              <Route path="/admin/comentarios" element={catalogAware(<AdminPage />)} />
              <Route path="/admin/assets" element={catalogAware(<AdminPage />)} />
              <Route path="/perfil" element={catalogAware(<PerfilPage />)} />
              <Route path="/wrapped" element={<WrappedPage />} />
              <Route path="/wrapped/:username" element={<WrappedPublicPage />} />
              <Route path="/feed" element={catalogAware(<FeedPage />)} />
              {/* /cartas no usa el catálogo global → ruta plana (sin gate) +
                  catalog-free en la policy, para no cebar ~170KB al aterrizar. */}
              <Route path="/cartas" element={<CartasPage />} />
              <Route path="/especiales" element={catalogAware(<EspecialesPage />)} />
              <Route path="/tier-lists" element={catalogAware(<TierListsPage />)} />
              <Route path="/tier-lists/:slug" element={catalogAware(<TierListsPage />)} />
              <Route path="/u/:username" element={catalogAware(<UsuarioPage />)} />
              <Route path="/u/:username/logros" element={catalogAware(<UsuarioLogrosPage />)} />
              <Route path="/games" element={catalogAware(<GamesHubPage />)} />
              {/* Rutas legacy de juegos → Navigate replace para links
                  existentes; _redirects emite 301 a nivel Cloudflare. */}
              <Route path="/games/shadow-guess" element={catalogAware(<GuessCharacterPage />)} />
              <Route path="/games/anime-reveal" element={catalogAware(<GuessAnimePage />)} />
              <Route path="/games/oraculo" element={catalogAware(<OraculoPage />)} />
              <Route path="/games/anigrid" element={catalogAware(<AnidelPage />)} />
              <Route path="/games/nexo-anime" element={catalogAware(<NexoAnimePage />)} />
              <Route path="/games/impostor-trial" element={catalogAware(<ImpostorPage />)} />
              <Route path="/games/elo-duel" element={catalogAware(<HigherOrLowerPage />)} />
              <Route path="/games/ruleta" element={catalogAware(<RuletaPage />)} />
              <Route
                path="/games/guess-character"
                element={<Navigate replace to="/games/shadow-guess" />}
              />
              <Route
                path="/games/guess-anime"
                element={<Navigate replace to="/games/anime-reveal" />}
              />
              <Route
                path="/games/anidel"
                element={<Navigate replace to="/games/anigrid" />}
              />
              <Route
                path="/games/impostor"
                element={<Navigate replace to="/games/impostor-trial" />}
              />
              <Route path="/omikuji" element={catalogAware(<OmikujiPage />)} />
              <Route path="/logros" element={catalogAware(<LogrosPage />)} />
              <Route path="/tv" element={catalogAware(<TvModePage />)} />
              <Route path="/mi-top5" element={catalogAware(<MiTop5Page />)} />
              <Route path="/leaderboards" element={catalogAware(<LeaderboardsPage />)} />
              {/* 404 a propósito independiente del catálogo: si el usuario
                  cae en una ruta inexistente, queremos ver el NotFoundPage
                  aunque el catálogo esté caído. */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      {!isFullscreenRoute && <MobileBottomNav />}
      {/* Footer completo solo en la home; el resto usa una versión mínima con
          marca, legal y copyright para reducir peso visual repetido. */}
      {!isFullscreenRoute && (
        <div className="pb-[calc(7rem_+_env(safe-area-inset-bottom))] md:pb-0">
          {location.pathname === '/' ? (
            <FederationColophon
              newsletterSlot={<NewsletterForm />}
              extraSlot={<FooterTopAnimes />}
            />
          ) : (
            <FooterSlim />
          )}
        </div>
      )}
    </div>
    </MotionConfig>
  )
}

export default App
