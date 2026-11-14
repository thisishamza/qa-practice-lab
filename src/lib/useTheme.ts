import { useContext } from 'react'
import { ThemeContext } from '../components/ui/ThemeContext'

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }

  return context
}
