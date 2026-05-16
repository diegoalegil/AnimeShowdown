import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { SoundProvider } from './contexts/SoundContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { queryClient } from './lib/queryClient.js'
import './index.css'
import App from './App.jsx'

// QueryClientProvider envuelve el árbol entero para que cualquier
// página/componente pueda usar useQuery sin pasar props. El cliente vive
// en lib/queryClient.js — singleton compartido entre tests y app.
// Se coloca DENTRO de BrowserRouter pero FUERA de Auth/Sound/Theme para
// que esos contexts puedan usar useQuery si lo necesitan en el futuro.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SoundProvider>
              <App />
            </SoundProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
