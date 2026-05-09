import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import InicioPage from './pages/InicioPage'
import PersonajesPage from './pages/PersonajesPage'
import TorneosPage from './pages/TorneosPage'
import RankingPage from './pages/RankingPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<InicioPage />} />
          <Route path="/personajes" element={<PersonajesPage />} />
          <Route path="/torneos" element={<TorneosPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
