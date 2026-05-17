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
// Audit P2 (2026-05-17): antes esta key (animeshowdown.theme) era
// compartida con LightModeToggle (que guardaba 'light'/'dark'). Al
// reload, cualquiera de los dos pisaba al otro y la preferencia se
// reseteaba a default. Separados:
//   - animeshowdown.theme.palette → magenta/cyan/violet/amber
//   - animeshowdown.theme.mode    → light/dark (LightModeToggle)
// Migración silenciosa de la key legacy 'animeshowdown.theme':
//   - Si vale 'light'/'dark' → lo movemos a .mode y borramos la vieja.
//   - Si vale una paleta válida → lo movemos a .palette y borramos vieja.
// Migra una sola vez por instalación.
const STORAGE_KEY = 'animeshowdown.theme.palette'
const LEGACY_KEY = 'animeshowdown.theme'
const ThemeContext = createContext(null)

function leerPaletaInicial() {
  try {
    const direct = localStorage.getItem(STORAGE_KEY)
    if (direct && themes[direct]) return direct
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy && themes[legacy]) {
      localStorage.setItem(STORAGE_KEY, legacy)
      localStorage.removeItem(LEGACY_KEY)
      return legacy
    }
    if (legacy === 'light' || legacy === 'dark') {
      // Era una preferencia mode; lo movemos para que LightModeToggle
      // la encuentre y dejamos la palette en default.
      localStorage.setItem('animeshowdown.theme.mode', legacy)
      localStorage.removeItem(LEGACY_KEY)
    }
    return 'magenta'
  } catch {
    return 'magenta'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(leerPaletaInicial)

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
