"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import type { EmailPreferenceKey } from "@/lib/notifications/policy"

type Preferences = { email: Record<EmailPreferenceKey, boolean>; essentialSecurityEmail: true }
const options: { key: EmailPreferenceKey; label: string; description: string }[] = [
  { key: "projectReferences", label: "Project references", description: "Email when another project references yours. Off until you turn it on." },
  { key: "projectStars", label: "Project stars", description: "Email when someone stars your project. Off until you turn it on." },
  { key: "publishApproved", label: "Publication approved", description: "Email when your project is approved and published. On by default." },
  { key: "revisionRequested", label: "Revisions requested", description: "Email when a submission needs revisions. On by default." },
  { key: "productAnnouncements", label: "Product announcements", description: "Occasional notes about What’s New. Off until you turn it on." },
  { key: "whatsNew", label: "What’s New releases", description: "Optional email when a release note is published. Off until you turn it on." },
]

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    void fetch("/api/notifications/preferences", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load notification settings.")
      const payload = await response.json() as { success?: boolean; data?: Preferences }
      if (!payload.success || !payload.data) throw new Error("Unable to load notification settings.")
      setPreferences(payload.data)
    }).catch(() => setError("Unable to load notification settings."))
  }, [])

  async function update(key: EmailPreferenceKey, checked: boolean) {
    if (!preferences) return
    const email = { ...preferences.email, [key]: checked }
    setPreferences({ ...preferences, email })
    setError("")
    try {
      const response = await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: { [key]: checked } }) })
      if (!response.ok) throw new Error("Unable to save notification settings.")
    } catch {
      setPreferences((current) => current ? { ...current, email: { ...current.email, [key]: preferences.email[key] } } : current)
      setError("Unable to save notification settings.")
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <div className="space-y-1">
        <h2 className="font-medium">Notifications</h2>
        <p className="text-sm text-muted-foreground">In-app notifications stay on. Choose which optional emails you receive. In-app history is kept for 90 days.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Account security</p>
          <p className="text-sm text-muted-foreground">Security emails are always sent and cannot be turned off.</p>
        </div>
        <Switch checked disabled aria-label="Account security email, always on" />
      </div>
      {options.map((option) => (
        <div key={option.key} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{option.label}</p>
            <p className="text-sm text-muted-foreground">{option.description}</p>
          </div>
          <Switch checked={preferences?.email[option.key] ?? false} disabled={!preferences} aria-label={option.label} onCheckedChange={(checked) => void update(option.key, checked)} />
        </div>
      ))}
    </div>
  )
}
