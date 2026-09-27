import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'yfs-theme'

const readSavedTheme = () => {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch (error) {
    console.error('Could not read the saved theme preference:', error)
    return 'dark'
  }
}

export default function useTheme() {
  const [theme, setTheme] = useState(readSavedTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (error) {
      console.error('Could not save the theme preference:', error)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')
  }

  return { theme, toggleTheme }
}
