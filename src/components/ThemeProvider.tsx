
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
  const [theme, setTheme] = useState<Theme>(defaultTheme)

  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) as Theme | null;
    if (storedTheme) {
      setTheme(storedTheme)
    }
  }, [storageKey]);

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
    
    if (effectiveTheme.startsWith("theme-")) {
        root.classList.add(effectiveTheme)
        // Also add dark/light class for base styles
        if(window.matchMedia("(prefers-color-scheme: dark)").matches) {
            root.classList.add("dark")
        } else {
             root.classList.add("light")
        }
    } else {
        root.classList.add(effectiveTheme)
    }

  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
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
