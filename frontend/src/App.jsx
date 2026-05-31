import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'sonner'
import Header from './components/Header'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import ScrollProgress from './components/ScrollProgress'
import CommandPaletteLazyMount from './components/CommandPaletteLazyMount'
import EmailVerifyBanner from './components/EmailVerifyBanner'
import BadgeUnlockListener from './components/BadgeUnlockListener'
import OnboardingGate from './components/onboarding/OnboardingGate'
import SakuraPetals from './components/SakuraPetals'
import KonamiCode from './components/KonamiCode'
import MobileBottomNav from './components/MobileBottomNav'
import RequireCatalog from './components/RequireCatalog'
import PageSkeleton from './components/PageSkeleton'
import { useCatalogoPersonajes } from './hooks/useCatalogoPersonajes'
import { recoverFromStaleAssetError } from './lib/staleAssetRecovery'
import i18n from './lib/i18n'

function lazyRoute(importer) {
  return lazy(() =>
    importer()
        .then((module) => {
          if (module?.default) return module
          const error = new TypeError("Cannot read properties of undefined (reading 'default')")
          if (recoverFromStaleAssetError(error)) return new Promise(() => {})
          throw error
        })
        .catch((error) => {
          if (recoverFromStaleAssetError(error)) return new Promise(() => {})
          throw error
        }),
  )
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
  anigrid: () => import('./pages/AnidelPage'),
  impostor: () => import('./pages/ImpostorPage'),
  eloDuel: () => import('./pages/HigherOrLowerPage'),
  perfil: () => import('./pages/PerfilPage'),
  logros: () => import('./pages/LogrosPage'),
  feed: () => import('./pages/FeedPage'),
  cartas: () => import('./pages/CartasPage'),
  tierLists: () => import('./pages/TierListsPage'),
}

const InicioPage = lazyRoute(routePreloaders.inicio)
const PersonajesPage = lazyRoute(routePreloaders.personajes)
const PersonajeDetailPage = lazyRoute(routePreloaders.personajeDetail)
const AnimesPage = lazyRoute(routePreloaders.animes)
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
const VotarPage = lazyRoute(routePreloaders.votar)
const DueloLivePage = lazyRoute(() => import('./pages/DueloLivePage'))
const LoginPage = lazyRoute(() => import('./pages/LoginPage'))
const RegisterPage = lazyRoute(() => import('./pages/RegisterPage'))
const AuthCallbackPage = lazyRoute(() => import('./pages/AuthCallbackPage'))
const ForgotPasswordPage = lazyRoute(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazyRoute(() => import('./pages/ResetPasswordPage'))
const AdminPage = lazyRoute(() => import('./pages/AdminPage'))
const PerfilPage = lazyRoute(routePreloaders.perfil)
const FeedPage = lazyRoute(routePreloaders.feed)
const CartasPage = lazyRoute(routePreloaders.cartas)
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
const AnidelPage = lazyRoute(routePreloaders.anigrid)
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
const ROUTE_WARMUP_DELAY_MS = 1800
const ROUTE_WARMUP_GAP_MS = 420
const SUPPORTED_ROUTE_LANGS = new Set(['es', 'en', 'ja'])
const idleRoutePreloads = [
  '/',
  '/personajes',
  '/animes',
  '/ranking',
  '/votar',
  '/torneos',
  '/games',
  '/games/shadow-guess',
  '/games/anime-reveal',
  '/games/anigrid',
  '/games/impostor-trial',
  '/games/elo-duel',
]

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
  if (pathname === '/games/anigrid') return routePreloaders.anigrid
  if (pathname === '/games/impostor-trial') return routePreloaders.impostor
  if (pathname === '/games/elo-duel') return routePreloaders.eloDuel
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

function canWarmupRoutes() {
  const connection = window.navigator?.connection
  if (!connection) return true
  if (connection.saveData) return false
  return !['slow-2g', '2g'].includes(connection.effectiveType)
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

// Reserva de altura por ruta (anti-CLS): el esqueleto y, después, la página
// real arrancan con esta min-height para que el swap no provoque saltos de
// layout. Medidas tomadas sobre la altura real de cada página larga.
function getRouteSkeletonReserve(pathname) {
  if (pathname === '/') return 'min-h-[5818px]'
  if (pathname === '/votar') return 'min-h-[1256px]'
  if (pathname === '/ranking') return 'min-h-[12233px]'
  if (pathname === '/fantasy') return 'min-h-[2100px]'
  if (pathname.startsWith('/personajes/')) return 'min-h-[4244px]'
  if (pathname.startsWith('/torneos/')) return 'min-h-[3404px]'
  if (pathname === '/games') return 'min-h-[2167px]'
  return ''
}

function App() {
  const location = useLocation()
  const catalogoQuery = useCatalogoPersonajes()
  useQueryLanguageSync(location.search)
  // Rutas fullscreen sin chrome global (TV mode, etc.). Si el usuario
  // navega aquí queremos que el viewport sea solo del contenido — sin
  // header global, sin bottom nav móvil, sin footer.
  const isFullscreenRoute = location.pathname.startsWith('/tv')
  const routeSkeletonReserve = getRouteSkeletonReserve(location.pathname)
  // Helper local para no repetir el wrapper en cada Route catalog-gated.
  const gated = (element) => (
    <RequireCatalog
      catalogoQuery={catalogoQuery}
      loadingPathname={location.pathname}
      loadingReserveClassName={routeSkeletonReserve}
    >
      {element}
    </RequireCatalog>
  )

  // Scroll to top en cada cambio de ruta — antes la página quedaba con el scroll
  // de la página anterior, así que al click en una card del catálogo el detalle
  // aparecía "desde abajo" (porque el navegador conserva la posición y el
  // contenido nuevo es más corto que el scroll heredado).
  useEffect(() => {
    window.scrollTo(0, 0)
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

    let cancelled = false
    let routeIndex = 0
    let delayId = 0
    let cancelIdle = () => {}

    const queueNextRoute = () => {
      if (cancelled || routeIndex >= idleRoutePreloads.length) return
      preloadRoute(idleRoutePreloads[routeIndex])
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
  }, [])

  return (
    <MotionConfig reducedMotion="user">
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
        toastOptions={{
          closeButtonAriaLabel: 'Cerrar notificacion',
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-fg-strong)',
          },
        }}
      />
      {/* /tv tiene chrome propio fullscreen. Omitimos header, footer y
          bottom nav global para no montar DOM visual duplicado. */}
      {!isFullscreenRoute && <Header />}
      {/* Listener global de unlock: side-effect-only, sin UI. Se monta
          siempre — internamente skipea cuando no hay user logueado. */}
      <BadgeUnlockListener />
      {/* Pétalos de sakura del 15 marzo al 15 abril (hanami). Auto-off el
          resto del año. Toggle vía localStorage animeshowdown.sakura. */}
      <SakuraPetals />
      {/* Easter egg ↑↑↓↓←→←→BA. */}
      <KonamiCode />
      {/* V-8: tras el primer login OAuth (username autogenerado) abre el
          modal de onboarding una vez. Internamente skipea si no hace falta. */}
      <OnboardingGate />
      <EmailVerifyBanner />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <div key={location.pathname} className="flex flex-1 flex-col">
          {/* Boundary a nivel de ruta. Un error de render en una página se
              contiene aquí y el shell (Header, Footer, nav) sigue vivo, en
              vez de tumbar toda la app contra el boundary raíz de main.jsx.
              El div padre lleva key={location.pathname}: al navegar a otra
              ruta este subárbol se remonta y el boundary se resetea solo, sin
              estado de error pegajoso entre páginas. */}
          <ErrorBoundary>
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

              {/* ===== Rutas que DEPENDEN del catálogo ===== */}
              {/* Cada una pasa por <RequireCatalog>: si el fetch del
                  catálogo aún está en vuelo muestra el <PageSkeleton> con la
                  forma de la ruta; si falló muestra CatalogoError con botón
                  Reintentar. Solo cuando el catálogo está hidratado renderiza
                  la página. */}
              <Route path="/" element={gated(<InicioPage />)} />
              <Route path="/personajes" element={gated(<PersonajesPage />)} />
              <Route path="/personajes/:slug" element={gated(<PersonajeDetailPage />)} />
              <Route path="/animes" element={gated(<AnimesPage />)} />
              <Route path="/animes/:slug/ranking" element={gated(<AnimeRankingPage />)} />
              <Route path="/animes/:slug" element={gated(<AnimeDetailPage />)} />
              <Route path="/torneos" element={gated(<TorneosPage />)} />
              <Route path="/torneos/crear" element={gated(<CrearTorneoPage />)} />
              <Route path="/torneos/:slug" element={gated(<TorneoDetailPage />)} />
              <Route path="/eventos" element={gated(<EventosIndexPage />)} />
              <Route path="/eventos/:slug" element={gated(<EventoDetailPage />)} />
              <Route path="/duelos/:par" element={gated(<DueloVersusPage />)} />
              <Route path="/versus" element={<Navigate replace to="/comparar" />} />
              <Route path="/compare" element={<Navigate replace to="/comparar" />} />
              <Route path="/comparar" element={gated(<CompararPage />)} />
              <Route path="/ranking" element={gated(<RankingPage />)} />
              <Route path="/fantasy" element={gated(<FantasyPage />)} />
              <Route path="/rankings/:slug" element={gated(<EditorialRankingPage />)} />
              <Route path="/descubre-personaje" element={gated(<DescubrePersonajePage />)} />
              <Route path="/random" element={<Navigate replace to="/descubre-personaje" />} />
              {/* Higher or Lower → ELO Duel. La ruta vieja redirige
                  client-side; _redirects emite 301 a nivel CDN. */}
              <Route
                path="/higher-or-lower"
                element={<Navigate replace to="/games/elo-duel" />}
              />
              <Route path="/votar" element={gated(<VotarPage />)} />
              <Route path="/duel-live" element={gated(<DueloLivePage />)} />
              <Route path="/admin" element={gated(<AdminPage />)} />
              <Route path="/admin/torneos" element={gated(<AdminPage />)} />
              <Route path="/admin/comentarios" element={gated(<AdminPage />)} />
              <Route path="/admin/assets" element={gated(<AdminPage />)} />
              <Route path="/perfil" element={gated(<PerfilPage />)} />
              <Route path="/feed" element={gated(<FeedPage />)} />
              <Route path="/cartas" element={gated(<CartasPage />)} />
              <Route path="/tier-lists" element={gated(<TierListsPage />)} />
              <Route path="/tier-lists/:slug" element={gated(<TierListsPage />)} />
              <Route path="/u/:username" element={gated(<UsuarioPage />)} />
              <Route path="/u/:username/logros" element={gated(<UsuarioLogrosPage />)} />
              <Route path="/games" element={gated(<GamesHubPage />)} />
              {/* Rutas legacy de juegos → Navigate replace para links
                  existentes; _redirects emite 301 a nivel Cloudflare. */}
              <Route path="/games/shadow-guess" element={gated(<GuessCharacterPage />)} />
              <Route path="/games/anime-reveal" element={gated(<GuessAnimePage />)} />
              <Route path="/games/anigrid" element={gated(<AnidelPage />)} />
              <Route path="/games/impostor-trial" element={gated(<ImpostorPage />)} />
              <Route path="/games/elo-duel" element={gated(<HigherOrLowerPage />)} />
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
              <Route path="/omikuji" element={gated(<OmikujiPage />)} />
              <Route path="/logros" element={gated(<LogrosPage />)} />
              <Route path="/tv" element={gated(<TvModePage />)} />
              <Route path="/mi-top5" element={gated(<MiTop5Page />)} />
              <Route path="/leaderboards" element={gated(<LeaderboardsPage />)} />
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
      {!isFullscreenRoute && (
        <div className="pb-[calc(7rem_+_env(safe-area-inset-bottom))] md:pb-0">
          <Footer />
        </div>
      )}
      </div>
    </MotionConfig>
  )
}

export default App
