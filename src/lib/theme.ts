export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'qa-practice-lab-theme'

export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable in private browsing; the in-memory theme still works.
  }
}
