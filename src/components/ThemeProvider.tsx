
"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system" | "love" | "retro" | "ocean" | "forest" | "synthwave" | "sunshine" | "mono"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme
  })

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove(
        "light", 
        "dark", 
        "theme-love", 
        "theme-retro",
        "theme-ocean",
        "theme-forest",
        "theme-synthwave",
        "theme-sunshine",
        "theme-mono"
    )

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches ? "dark" : "light"
    }
    
    // For custom themes, we need to apply the base dark/light class as well
    // for components that rely on the base .dark selector.
    if (effectiveTheme.startsWith("theme-")) {
        root.classList.add(effectiveTheme)
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        const selectedThemeHasDarkVariant = ['love', 'retro', 'ocean', 'forest', 'sunshine', 'mono'].includes(effectiveTheme.replace('theme-',''));
        
        if (isDark && selectedThemeHasDarkVariant) {
            root.classList.add("dark");
        } else if (effectiveTheme !== 'theme-synthwave') {
            root.classList.add("light");
        }

    } else {
        root.classList.add(effectiveTheme)
    }

  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
