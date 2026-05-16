import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'sonner'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import CommandPalette from './components/CommandPalette'
import Splash from './components/Splash'
import EmailVerifyBanner from './components/EmailVerifyBanner'
import BadgeUnlockListener from './components/BadgeUnlockListener'
import SakuraPetals from './components/SakuraPetals'
import KonamiCode from './components/KonamiCode'

// InicioPage es la landing — la carga en el bundle principal porque casi
// todo visitante entra por '/' y queremos que renderice sin esperar a un
// chunk extra. El resto va a code splitting con React.lazy: cada ruta es
// su propio chunk asíncrono, así el bundle inicial baja de >500KB a algo
// razonable (Vite avisa de chunks grandes en build).
import InicioPage from './pages/InicioPage'

const PersonajesPage = lazy(() => import('./pages/PersonajesPage'))
const PersonajeDetailPage = lazy(() => import('./pages/PersonajeDetailPage'))
const AnimesPage = lazy(() => import('./pages/AnimesPage'))
const TorneosPage = lazy(() => import('./pages/TorneosPage'))
const TorneoDetailPage = lazy(() => import('./pages/TorneoDetailPage'))
const RankingPage = lazy(() => import('./pages/RankingPage'))
const HigherOrLowerPage = lazy(() => import('./pages/HigherOrLowerPage'))
const VotarPage = lazy(() => import('./pages/VotarPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const PerfilPage = lazy(() => import('./pages/PerfilPage'))
const UsuarioPage = lazy(() => import('./pages/UsuarioPage'))
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
const ApoyaPage = lazy(() => import('./pages/ApoyaPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const DmcaPage = lazy(() => import('./pages/DmcaPage'))
const TvModePage = lazy(() => import('./pages/TvModePage'))
const MiTop5Page = lazy(() => import('./pages/MiTop5Page'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const NewsletterConfirmarPage = lazy(() => import('./pages/NewsletterConfirmarPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Fallback de Suspense compartido. Minimalista a propósito: la página entera
// está dentro de <AnimatePresence motion fade>, así que el flash de carga
// dura milisegundos en navegación normal y la animación oculta el cambio.
function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
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

  return (
    <div className="flex min-h-screen flex-col">
      <Splash />
      <ScrollProgress />
      <CommandPalette />
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
      <Header />
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
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-1 flex-col"
          >
            <Suspense fallback={<PageLoader />}>
              <Routes location={location}>
                <Route path="/" element={<InicioPage />} />
                <Route path="/personajes" element={<PersonajesPage />} />
                <Route path="/personajes/:slug" element={<PersonajeDetailPage />} />
                <Route path="/animes" element={<AnimesPage />} />
                <Route path="/torneos" element={<TorneosPage />} />
                <Route path="/torneos/crear" element={<CrearTorneoPage />} />
                <Route path="/torneos/:slug" element={<TorneoDetailPage />} />
                <Route path="/ranking" element={<RankingPage />} />
                <Route path="/higher-or-lower" element={<HigherOrLowerPage />} />
                <Route path="/votar" element={<VotarPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/perfil" element={<PerfilPage />} />
                <Route path="/u/:username" element={<UsuarioPage />} />
                <Route path="/verify" element={<VerifyPage />} />
                <Route path="/newsletter/confirmar" element={<NewsletterConfirmarPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/api-docs" element={<ApiDocsPage />} />
                <Route path="/games" element={<GamesHubPage />} />
                <Route path="/games/guess-character" element={<GuessCharacterPage />} />
                <Route path="/games/guess-anime" element={<GuessAnimePage />} />
                <Route path="/games/anidel" element={<AnidelPage />} />
                <Route path="/games/impostor" element={<ImpostorPage />} />
                <Route path="/omikuji" element={<OmikujiPage />} />
                <Route path="/glossary" element={<GlossaryPage />} />
                <Route path="/apoya" element={<ApoyaPage />} />
                <Route path="/privacidad" element={<PrivacyPage />} />
                <Route path="/terminos" element={<TermsPage />} />
                <Route path="/dmca" element={<DmcaPage />} />
                <Route path="/tv" element={<TvModePage />} />
                <Route path="/mi-top5" element={<MiTop5Page />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}

export default App
