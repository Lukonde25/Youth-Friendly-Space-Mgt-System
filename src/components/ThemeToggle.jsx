import React from 'react'

export default function ThemeToggle({ theme, onToggle, className = '' }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label = nextTheme === 'dark' ? 'Dark mode' : 'Light mode'

  return (
    <button
      type="button"
      className={['theme-toggle', className].filter(Boolean).join(' ')}
      onClick={onToggle}
      aria-label={`Switch to ${label.toLowerCase()}`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${label.toLowerCase()}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </>
        ) : (
          <path d="M20.6 15.3A8.5 8.5 0 0 1 8.7 3.4 8.5 8.5 0 1 0 20.6 15.3Z" />
        )}
      </svg>
    </button>
  )
}
