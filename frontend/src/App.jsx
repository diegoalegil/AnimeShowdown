import { lazy, Suspense, useEffect } from 'react'
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

// Todas las rutas, incluida home, van detrás de React.lazy. InicioPage
// importa el catálogo estático y varias secciones visuales pesadas; si se
// queda en el bundle raíz, cualquier ruta paga ese coste antes de pintar.
const InicioPage = lazy(() => import('./pages/InicioPage'))
const PersonajesPage = lazy(() => import('./pages/PersonajesPage'))
const PersonajeDetailPage = lazy(() => import('./pages/PersonajeDetailPage'))
const AnimesPage = lazy(() => import('./pages/AnimesPage'))
const AnimeDetailPage = lazy(() => import('./pages/AnimeDetailPage'))
const TorneosPage = lazy(() => import('./pages/TorneosPage'))
const TorneoDetailPage = lazy(() => import('./pages/TorneoDetailPage'))
const EventosIndexPage = lazy(() => import('./pages/EventosIndexPage'))
const EventoDetailPage = lazy(() => import('./pages/EventoDetailPage'))
const DueloVersusPage = lazy(() => import('./pages/DueloVersusPage'))
const RankingPage = lazy(() => import('./pages/RankingPage'))
const HigherOrLowerPage = lazy(() => import('./pages/HigherOrLowerPage'))
const VotarPage = lazy(() => import('./pages/VotarPage'))
const DueloLivePage = lazy(() => import('./pages/DueloLivePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const PerfilPage = lazy(() => import('./pages/PerfilPage'))
const UsuarioPage = lazy(() => import('./pages/UsuarioPage'))
const UsuarioLogrosPage = lazy(() => import('./pages/UsuarioLogrosPage'))
const CrearTorneoPage = lazy(() => import('./pages/CrearTorneoPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'))
const StatusPage = lazy(() => import('./pages/StatusPage'))
const GamesHubPage = lazy(() => import('./pages/GamesHubPage'))
const GuessCharacterPage = lazy(() => import('./pages/GuessCharacterPage'))
const GuessAnimePage = lazy(() => import('./pages/GuessAnimePage'))
const AnidelPage = lazy(() => import('./pages/AnidelPage'))
const ImpostorPage = lazy(() => import('./pages/ImpostorPage'))
const OmikujiPage = lazy(() => import('./pages/OmikujiPage'))
const GlossaryPage = lazy(() => import('./pages/GlossaryPage'))
const LogrosPage = lazy(() => import('./pages/LogrosPage'))
const ApoyaPage = lazy(() => import('./pages/ApoyaPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const DmcaPage = lazy(() => import('./pages/DmcaPage'))
const TvModePage = lazy(() => import('./pages/TvModePage'))
const MiTop5Page = lazy(() => import('./pages/MiTop5Page'))
const LeaderboardsPage = lazy(() => import('./pages/LeaderboardsPage'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const NewsletterConfirmarPage = lazy(() => import('./pages/NewsletterConfirmarPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Fallback de Suspense compartido. Audit producto (2026-05-18): el
// spinner solo sobre fondo negro hacía que una carga lenta (1ª visita,
// red mala, chunk grande) pareciera la página rota. Ahora damos un
// shell mínimo con identidad y label legible — sigue siendo barato
// (cero requests, todo CSS), pero comunica "estoy cargando" en vez
// de "no pasa nada".
function PageLoader() {
  // Audit user feedback (2026-05-22): el orb dorado pulsando con 3 dots
  // se leia como "circulo amarillo feo" — destacaba demasiado el amarillo,
  // que no es ni accent (#9f1d2c carmesi) ni gold (#c5a15a) del proyecto.
  // Rediseño "premium anime":
  //   - Anillo accent rotando lento (~1.6s) con conic gradient + ring
  //     accent-soft para sombra suave (no hard border).
  //   - Kanji 勝 (shou, "victoria") dorado centrado con glow accent.
  //   - Halo accent pulsando detras (animationDuration 2.4s, suave).
  //   - Respeta prefers-reduced-motion: el anillo y halo se quedan
  //     estaticos, solo el aura sigue muy lenta (sin marear).
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
          Catalogo no disponible
        </p>
        <h1 className="text-2xl font-black text-fg-strong">
          No pudimos cargar los personajes
        </h1>
        <p className="text-sm leading-6 text-fg-muted">
          AnimeShowdown necesita el catalogo para montar rankings, juegos y fichas sin datos incompletos.
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

// Audit externo F001 (2026-05-22): wrapper que sólo deja pasar children
// cuando el catálogo de personajes está hidratado. Antes el gate de catálogo
// vivía a nivel App.jsx y bloqueaba TODAS las rutas — incluso /login,
// /status, /faq, /auth/callback, /terms — si el catálogo fallaba. Una caída
// de /api/personajes/catalogo dejaba la app entera inaccesible aunque las
// rutas de soporte/auth no dependieran de él. Ahora envolvemos sólo las
// rutas que SÍ usan el catálogo (home, /personajes, /votar, ranking, games,
// torneos, perfil...). El resto carga independiente.
function RequireCatalog({ catalogoQuery, children }) {
  const catalogoListo = Array.isArray(catalogoQuery.data) && catalogoQuery.data.length > 0
  const catalogoFallido = !catalogoListo && catalogoQuery.isError
  if (catalogoListo) return children
  if (catalogoFallido) return <CatalogoError onRetry={() => catalogoQuery.refetch()} />
  return <PageLoader />
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
      {/* Sprint 5h (2026-05-18): /tv tiene su propio header fullscreen
          fixed z-50; el global Header queda detrás z-30 y solo añade DOM
          noise + paint costoso del logo flotante. Skipeamos cuando la
          ruta es /tv para que el browser no monte ambos.
          Audit externo AS-017 (2026-05-22): Footer y MobileBottomNav
          también deben omitirse en /tv — antes seguían montados y rompían
          la sensación de pantalla completa cuando el usuario hacía
          scroll por error o cambiaba de pestaña. */}
      {!isFullscreenRoute && <Header />}
      {/* Listener global de unlock: side-effect-only, sin UI. Se monta
          siempre — internamente skipea cuando no hay user logueado. */}
      <BadgeUnlockListener />
      {/* Plan v2 §13.7: pétalos de sakura del 15 marzo al 15 abril
          (hanami). Auto-off el resto del año. Toggle vía localStorage
          animeshowdown.sakura = 'on' | 'off' para override manual. */}
      <SakuraPetals />
      {/* Plan v2 §13.12: easter egg ↑↑↓↓←→←→BA. */}
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
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/apoya" element={<ApoyaPage />} />
              <Route path="/privacidad" element={<PrivacyPage />} />
              <Route path="/terminos" element={<TermsPage />} />
              <Route path="/dmca" element={<DmcaPage />} />
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
              <Route path="/ranking" element={gated(<RankingPage />)} />
              {/* Higher or Lower → ELO Duel rebrand (Plan v2 §14). La ruta
                  vieja redirige client-side; el _redirects de Cloudflare
                  hace 301 a nivel CDN para preservar SEO. */}
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
              {/* Nombres rebrandeados (Plan v2 §14). Rutas viejas →
                  Navigate replace para mantener funcionando los links
                  indexados; el _redirects en /public emite 301 a nivel
                  Cloudflare para que Google traslade el SEO. */}
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
        <div className="pb-16 md:pb-0">
          <Footer />
        </div>
      )}
    </div>
  )
}

export default App
