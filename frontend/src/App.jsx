import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'sonner'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import CommandPalette from './components/CommandPalette'
import Splash from './components/Splash'
import InicioPage from './pages/InicioPage'
import PersonajesPage from './pages/PersonajesPage'
import PersonajeDetailPage from './pages/PersonajeDetailPage'
import AnimesPage from './pages/AnimesPage'
import TorneosPage from './pages/TorneosPage'
import TorneoDetailPage from './pages/TorneoDetailPage'
import RankingPage from './pages/RankingPage'
import VotarPage from './pages/VotarPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AdminPage from './pages/AdminPage'
import PerfilPage from './pages/PerfilPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  const location = useLocation()
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
            <Routes location={location}>
              <Route path="/" element={<InicioPage />} />
              <Route path="/personajes" element={<PersonajesPage />} />
              <Route path="/personajes/:slug" element={<PersonajeDetailPage />} />
              <Route path="/animes" element={<AnimesPage />} />
              <Route path="/torneos" element={<TorneosPage />} />
              <Route path="/torneos/:slug" element={<TorneoDetailPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/votar" element={<VotarPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}

export default App
