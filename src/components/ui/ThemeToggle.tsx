import { useTheme } from '../../lib/useTheme'
import { Icon } from './Icon'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
    </button>
  )
}
