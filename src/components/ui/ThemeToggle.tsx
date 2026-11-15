import { useTheme } from '../../lib/useTheme'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <IconButton
      label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className="theme-toggle"
      onClick={toggleTheme}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
    </IconButton>
  )
}
