import { useEffect, useState, type ReactNode } from 'react'
import { applyTheme, persistTheme, resolveInitialTheme, type Theme } from '../../lib/theme'
import { ThemeContext } from './ThemeContext'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme())

  useEffect(() => {
    applyTheme(theme)
    persistTheme(theme)
  }, [theme])

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme)
  }

  function toggleTheme() {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
