import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import InicioPage from './pages/InicioPage'
import PersonajesPage from './pages/PersonajesPage'
import PersonajeDetailPage from './pages/PersonajeDetailPage'
import TorneosPage from './pages/TorneosPage'
import TorneoDetailPage from './pages/TorneoDetailPage'
import RankingPage from './pages/RankingPage'
import VotarPage from './pages/VotarPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
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
              <Route path="/torneos" element={<TorneosPage />} />
              <Route path="/torneos/:slug" element={<TorneoDetailPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/votar" element={<VotarPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
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
