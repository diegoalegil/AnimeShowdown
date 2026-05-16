import { createContext, useContext, useEffect, useState } from 'react'

// eslint-disable-next-line react-refresh/only-export-components
export const themes = {
  magenta: {
    nombre: 'Magenta',
    vars: {
      '--color-accent': '#ff2e63',
      '--color-accent-hover': '#ff5483',
      '--color-accent-soft': 'rgb(255 46 99 / 0.12)',
    },
  },
  cyan: {
    nombre: 'Cyan',
    vars: {
      '--color-accent': '#22d3ee',
      '--color-accent-hover': '#67e8f9',
      '--color-accent-soft': 'rgb(34 211 238 / 0.12)',
    },
  },
  violet: {
    nombre: 'Violet',
    vars: {
      '--color-accent': '#a855f7',
      '--color-accent-hover': '#c084fc',
      '--color-accent-soft': 'rgb(168 85 247 / 0.12)',
    },
  },
  amber: {
    nombre: 'Amber',
    vars: {
      '--color-accent': '#f59e0b',
      '--color-accent-hover': '#fbbf24',
      '--color-accent-soft': 'rgb(245 158 11 / 0.12)',
    },
  },
}

const order = ['magenta', 'cyan', 'violet', 'amber']
const STORAGE_KEY = 'animeshowdown.theme'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored && themes[stored] ? stored : 'magenta'
    } catch {
      return 'magenta'
    }
  })

  useEffect(() => {
    const t = themes[theme]
    if (!t) return
    Object.entries(t.vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  const cycleTheme = () => {
    const idx = order.indexOf(theme)
    const next = order[(idx + 1) % order.length]
    setThemeState(next)
    return themes[next].nombre
  }

  return (
    <ThemeContext.Provider value={{ theme, cycleTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
