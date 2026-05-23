import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import CommandPaletteLazyMount from './components/CommandPaletteLazyMount'
import Splash from './components/Splash'
import EmailVerifyBanner from './components/EmailVerifyBanner'
import BadgeUnlockListener from './components/BadgeUnlockListener'
import SakuraPetals from './components/SakuraPetals'
import KonamiCode from './components/KonamiCode'
import MobileBottomNav from './components/MobileBottomNav'
import { useCatalogoPersonajes } from './hooks/useCatalogoPersonajes'
import { recoverFromStaleAssetError } from './lib/staleAssetRecovery'

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
const InicioPage = lazyRoute(() => import('./pages/InicioPage'))
const PersonajesPage = lazyRoute(() => import('./pages/PersonajesPage'))
const PersonajeDetailPage = lazyRoute(() => import('./pages/PersonajeDetailPage'))
const AnimesPage = lazyRoute(() => import('./pages/AnimesPage'))
const AnimeDetailPage = lazyRoute(() => import('./pages/AnimeDetailPage'))
const TorneosPage = lazyRoute(() => import('./pages/TorneosPage'))
const TorneoDetailPage = lazyRoute(() => import('./pages/TorneoDetailPage'))
const EventosIndexPage = lazyRoute(() => import('./pages/EventosIndexPage'))
const EventoDetailPage = lazyRoute(() => import('./pages/EventoDetailPage'))
const DueloVersusPage = lazyRoute(() => import('./pages/DueloVersusPage'))
const CompararPage = lazyRoute(() => import('./pages/CompararPage'))
const RankingPage = lazyRoute(() => import('./pages/RankingPage'))
const HigherOrLowerPage = lazyRoute(() => import('./pages/HigherOrLowerPage'))
const VotarPage = lazyRoute(() => import('./pages/VotarPage'))
const DueloLivePage = lazyRoute(() => import('./pages/DueloLivePage'))
const LoginPage = lazyRoute(() => import('./pages/LoginPage'))
const RegisterPage = lazyRoute(() => import('./pages/RegisterPage'))
const AuthCallbackPage = lazyRoute(() => import('./pages/AuthCallbackPage'))
const ForgotPasswordPage = lazyRoute(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazyRoute(() => import('./pages/ResetPasswordPage'))
const AdminPage = lazyRoute(() => import('./pages/AdminPage'))
const PerfilPage = lazyRoute(() => import('./pages/PerfilPage'))
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
const GamesHubPage = lazyRoute(() => import('./pages/GamesHubPage'))
const GuessCharacterPage = lazyRoute(() => import('./pages/GuessCharacterPage'))
const GuessAnimePage = lazyRoute(() => import('./pages/GuessAnimePage'))
const AnidelPage = lazyRoute(() => import('./pages/AnidelPage'))
const ImpostorPage = lazyRoute(() => import('./pages/ImpostorPage'))
const OmikujiPage = lazyRoute(() => import('./pages/OmikujiPage'))
const GlossaryPage = lazyRoute(() => import('./pages/GlossaryPage'))
const LogrosPage = lazyRoute(() => import('./pages/LogrosPage'))
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

// Fallback de Suspense compartido con shell mínimo de marca y label legible.
function PageLoader() {
  // Anillo accent, kanji 勝 y tres dots suaves. Las clases motion-safe
  // respetan prefers-reduced-motion.
  return (
    <div
      className="as-stage as-stage-visual as-stage-home flex flex-1 items-center justify-center px-5 py-20"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="as-panel relative flex min-w-64 flex-col items-center gap-5 rounded-2xl p-8 shadow-[0_0_80px_-32px_var(--color-accent)]">
        {/* Anillo accent rotando + kanji 勝 (victoria) dorado.
            Usamos motion-safe:* para que prefers-reduced-motion deje
            los layers estaticos sin marear a usuarios sensibles. */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full motion-safe:animate-ping"
            style={{
              background: 'radial-gradient(circle, rgb(159 29 44 / 0.45) 0%, transparent 70%)',
              animationDuration: '2.4s',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full motion-safe:animate-spin"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgb(159 29 44 / 0.85) 90deg, rgb(197 161 90 / 0.95) 200deg, transparent 320deg)',
              animationDuration: '1.6s',
              WebkitMask: 'radial-gradient(circle, transparent 56%, black 58%)',
              mask: 'radial-gradient(circle, transparent 56%, black 58%)',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-1.5 rounded-full border border-accent/35 bg-bg/60 backdrop-blur"
          />
          <span
            aria-hidden="true"
            lang="ja"
            className="relative font-mono text-2xl font-black text-gold"
            style={{ textShadow: '0 0 18px rgb(197 161 90 / 0.75), 0 0 30px rgb(159 29 44 / 0.55)' }}
          >
            勝
          </span>
        </div>
        {/* 3 dots accent — bouncing suave, mantiene la sensación
            "thinking" para que la espera no parezca congelada. */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 motion-safe:animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 motion-safe:animate-bounce" style={{ animationDelay: '160ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 motion-safe:animate-bounce" style={{ animationDelay: '320ms' }} />
        </div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
          Preparando arena
        </p>
        <span className="sr-only">
          Cargando la página de AnimeShowdown, un momento.
        </span>
      </div>
    </div>
  )
}

function CatalogoError({ onRetry }) {
  return (
    <div className="as-stage as-stage-visual as-stage-home flex flex-1 items-center justify-center px-5 py-20">
      <div className="as-panel flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">
          Catálogo no disponible
        </p>
        <h1 className="text-2xl font-black text-fg-strong">
          No pudimos cargar los personajes
        </h1>
        <p className="text-sm leading-6 text-fg-muted">
          AnimeShowdown necesita el catálogo para montar rankings, juegos y fichas sin datos incompletos.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-600"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}

function useCatalogoLoadingTimeout(isLoading) {
  const [attempt, setAttempt] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading || timedOut) return undefined

    const id = window.setTimeout(() => setTimedOut(true), 12000)
    return () => window.clearTimeout(id)
  }, [attempt, isLoading, timedOut])

  return [
    isLoading && timedOut,
    () => {
      setTimedOut(false)
      setAttempt((value) => value + 1)
    },
  ]
}

// Wrapper que sólo deja pasar children cuando el catálogo de personajes está
// hidratado. Las rutas de soporte/auth/legal/status cargan independiente para
// que sigan disponibles aunque falle /api/personajes/catalogo.
function RequireCatalog({ catalogoQuery, children }) {
  // Diferenciamos dos estados distintos:
  //   - loading: catalogoQuery aún no resolvió.
  //   - loaded-empty: el backend respondió, pero con [] (DB nueva, seed
  //     no aplicado, migración en curso, entorno de staging vacío...).
  const hasData = Array.isArray(catalogoQuery.data) && catalogoQuery.data.length > 0
  const isLoading = catalogoQuery.isPending || catalogoQuery.isFetching
  const isError = catalogoQuery.isError
  const isLoadedEmpty =
    !hasData && !isLoading && !isError && Array.isArray(catalogoQuery.data)
  const [hasTimedOut, resetTimeout] = useCatalogoLoadingTimeout(isLoading)
  const handleRetry = () => {
    resetTimeout()
    catalogoQuery.refetch()
  }

  if (hasData) return children
  if (isError || hasTimedOut) return <CatalogoError onRetry={handleRetry} />
  if (isLoadedEmpty) return <CatalogoVacio onRetry={handleRetry} />
  return <PageLoader />
}

function CatalogoVacio({ onRetry }) {
  return (
    <div className="as-stage as-stage-visual as-stage-home flex flex-1 items-center justify-center px-5 py-20">
      <div className="as-panel flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">
          Catálogo vacío
        </p>
        <h1 className="text-2xl font-black text-fg-strong">
          Aún no hay personajes para mostrar
        </h1>
        <p className="text-sm leading-6 text-fg-muted">
          El backend respondió correctamente pero el catálogo está vacío. Si
          eres operador, ejecuta el seed o aplica las migraciones pendientes.
          Si eres usuario, vuelve en un rato — estamos preparando el roster.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-600"
        >
          Volver a comprobar
        </button>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const catalogoQuery = useCatalogoPersonajes()
  // Rutas fullscreen sin chrome global (TV mode, etc.). Si el usuario
  // navega aquí queremos que el viewport sea solo del contenido — sin
  // header global, sin bottom nav móvil, sin footer.
  const isFullscreenRoute = location.pathname.startsWith('/tv')
  // Helper local para no repetir el wrapper en cada Route catalog-gated.
  const gated = (element) => (
    <RequireCatalog catalogoQuery={catalogoQuery}>{element}</RequireCatalog>
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

  return (
    <div className="flex min-h-screen flex-col">
      <Splash />
      <ScrollProgress />
      <CommandPaletteLazyMount />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
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
      <EmailVerifyBanner />
      <main className="flex flex-1 flex-col">
        <div key={location.pathname} className="flex flex-1 flex-col">
          <Suspense fallback={<PageLoader />}>
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
                  catálogo aún está en vuelo muestra PageLoader; si falló
                  muestra CatalogoError con botón Reintentar. Solo cuando
                  el catálogo está hidratado renderiza la página. */}
              <Route path="/" element={gated(<InicioPage />)} />
              <Route path="/personajes" element={gated(<PersonajesPage />)} />
              <Route path="/personajes/:slug" element={gated(<PersonajeDetailPage />)} />
              <Route path="/animes" element={gated(<AnimesPage />)} />
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
              <Route path="/admin/comentarios" element={gated(<AdminPage />)} />
              <Route path="/perfil" element={gated(<PerfilPage />)} />
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
        </div>
      </main>
      {!isFullscreenRoute && <MobileBottomNav />}
      {!isFullscreenRoute && (
        <div className="pb-28 md:pb-0">
          <Footer />
        </div>
      )}
    </div>
  )
}

export default App
