"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => {
      let saved: string | null = null
      try { saved = localStorage.getItem("gallery-theme") } catch { /* Storage may be unavailable. */ }
      const next = saved === "dark" || (saved !== "light" && media.matches)
      document.documentElement.classList.toggle("dark", next)
      setDark(next)
    }
    sync()
    media.addEventListener("change", sync)
    window.addEventListener("storage", sync)
    return () => {
      media.removeEventListener("change", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("gallery-theme", next ? "dark" : "light") } catch { /* Keep the current session usable. */ }
    setDark(next)
  }

  return <Button variant="outline" size="sm" onClick={toggle} aria-label={dark === null ? "Toggle color theme" : `Switch to ${dark ? "light" : "dark"} mode`}>
    {dark === null ? "Theme" : dark ? "Light mode" : "Dark mode"}
  </Button>
}
