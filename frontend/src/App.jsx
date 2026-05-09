import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Header from './components/Header'
import Footer from './components/Footer'
import InicioPage from './pages/InicioPage'
import PersonajesPage from './pages/PersonajesPage'
import TorneosPage from './pages/TorneosPage'
import RankingPage from './pages/RankingPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
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
              <Route path="/torneos" element={<TorneosPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/login" element={<LoginPage />} />
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
