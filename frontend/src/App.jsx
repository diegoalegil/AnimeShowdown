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
  // Audit user feedback (2026-05-20): el spinner anterior tenia un kanji 戦
  // gigante girando en el centro — se veia raro/desconcertante para usuarios
  // que no lo entienden. Reemplazo por un orb dorado pulsando con 3 dots
  // animados — mantiene identidad premium (no spinner-generico-SaaS) sin
  // depender de iconografia japonesa que asuste.
  return (
    <div
      className="as-stage as-stage-visual as-stage-home flex flex-1 items-center justify-center px-5 py-20"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="as-panel relative flex min-w-64 flex-col items-center gap-5 rounded-2xl p-8 shadow-[0_0_70px_-34px_var(--color-gold)]">
        {/* Orb dorado con halo + glow pulsante */}
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-ping rounded-full bg-gold/30" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-gold via-amber-400 to-gold/60 shadow-[0_0_30px_rgb(197_161_90_/_0.7)]" />
          <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-amber-200 to-gold opacity-90" />
        </div>
        {/* 3 dots animados estilo thinking */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold/70" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold/70" style={{ animationDelay: '160ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold/70" style={{ animationDelay: '320ms' }} />
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

function App() {
  const location = useLocation()

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
          ruta es /tv para que el browser no monte ambos. */}
      {!location.pathname.startsWith('/tv') && <Header />}
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
              <Route path="/" element={<InicioPage />} />
              <Route path="/personajes" element={<PersonajesPage />} />
              <Route path="/personajes/:slug" element={<PersonajeDetailPage />} />
              <Route path="/animes" element={<AnimesPage />} />
              <Route path="/animes/:slug" element={<AnimeDetailPage />} />
              <Route path="/torneos" element={<TorneosPage />} />
              <Route path="/torneos/crear" element={<CrearTorneoPage />} />
              <Route path="/torneos/:slug" element={<TorneoDetailPage />} />
              <Route path="/eventos" element={<EventosIndexPage />} />
              <Route path="/eventos/:slug" element={<EventoDetailPage />} />
              <Route path="/duelos/:par" element={<DueloVersusPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              {/* Higher or Lower → ELO Duel rebrand (Plan v2 §14). La ruta
                  vieja redirige client-side; el _redirects de Cloudflare
                  hace 301 a nivel CDN para preservar SEO. */}
              <Route
                path="/higher-or-lower"
                element={<Navigate replace to="/games/elo-duel" />}
              />
              <Route path="/votar" element={<VotarPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/comentarios" element={<AdminPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="/u/:username" element={<UsuarioPage />} />
              <Route path="/u/:username/logros" element={<UsuarioLogrosPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/newsletter/confirmar" element={<NewsletterConfirmarPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/games" element={<GamesHubPage />} />
              {/* Nombres rebrandeados (Plan v2 §14). Rutas viejas →
                  Navigate replace para mantener funcionando los links
                  indexados; el _redirects en /public emite 301 a nivel
                  Cloudflare para que Google traslade el SEO. */}
              <Route path="/games/shadow-guess" element={<GuessCharacterPage />} />
              <Route path="/games/anime-reveal" element={<GuessAnimePage />} />
              <Route path="/games/anigrid" element={<AnidelPage />} />
              <Route path="/games/impostor-trial" element={<ImpostorPage />} />
              <Route path="/games/elo-duel" element={<HigherOrLowerPage />} />
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
              <Route path="/omikuji" element={<OmikujiPage />} />
              <Route path="/glossary" element={<GlossaryPage />} />
              <Route path="/logros" element={<LogrosPage />} />
              <Route path="/apoya" element={<ApoyaPage />} />
              <Route path="/privacidad" element={<PrivacyPage />} />
              <Route path="/terminos" element={<TermsPage />} />
              <Route path="/dmca" element={<DmcaPage />} />
              <Route path="/tv" element={<TvModePage />} />
              <Route path="/mi-top5" element={<MiTop5Page />} />
              <Route path="/leaderboards" element={<LeaderboardsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      <MobileBottomNav />
      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
    </div>
  )
}

export default App
