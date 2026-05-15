'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Toggle theme"
      >
        <Monitor size={15} strokeWidth={1.5} />
      </button>
    )
  }

  const cycle = () => {
    if (theme === 'system') setTheme('dark')
    else if (theme === 'dark') setTheme('light')
    else setTheme('system')
  }

  return (
    <button
      onClick={cycle}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Moon size={15} strokeWidth={1.5} />
      ) : theme === 'light' ? (
        <Sun size={15} strokeWidth={1.5} />
      ) : (
        <Monitor size={15} strokeWidth={1.5} />
      )}
    </button>
  )
}
