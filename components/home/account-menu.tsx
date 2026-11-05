"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

export type HomeUser = { name: string; email: string; image?: string | null }

export function AccountMenu({ user }: { user: HomeUser }) {
  const router = useRouter()
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || user.email[0]?.toUpperCase()

  async function signOut() {
    setError(false)
    setPending(true)
    try {
      const result = await authClient.signOut()
      if (result.error) { setError(true); return }
      router.replace("/home")
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Account menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Avatar className="after:border-0">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="text-xs text-foreground">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <DropdownMenuItem render={<Link href="/profile" />}>Profile</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
            <DropdownMenuItem disabled={pending} onClick={signOut}>{pending ? "Signing out…" : "Sign out"}</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p role="alert" className="absolute right-8 mt-2 text-sm text-destructive">Could not sign out. Please try again.</p>}
    </div>
  )
}
