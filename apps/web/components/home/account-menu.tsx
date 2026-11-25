"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "cn"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { authClient } from "@/lib/auth-client"

export type HomeUser = { id: string; name: string; email: string; image?: string | null }

const accountTabs = [
  { value: "profile", label: "Profile" },
  { value: "projects", label: "Projects" },
  { value: "settings", label: "Settings" },
] as const

export function AccountMenu({ user, avatarClassName, signedOutHref = "/home" }: { user: HomeUser; avatarClassName?: string; signedOutHref?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setConfirmSignOut(false)
  }

  async function signOut() {
    setError(false)
    setPending(true)
    try {
      const result = await authClient.signOut()
      if (result.error) {
        setError(true)
        return
      }
      queryClient.clear()
      setOpen(false)
      setConfirmSignOut(false)
      if (/^https?:\/\//.test(signedOutHref)) {
        window.location.assign(signedOutHref)
        return
      }
      router.replace(signedOutHref)
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex items-center">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <DialogTrigger
            render={
              <TooltipTrigger
                aria-label="Account"
                className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            }
          >
            <Avatar className={cn("after:border-0", avatarClassName)}>
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback>
                <span aria-hidden="true" className="flex size-6 items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/icons/user.svg" alt="" className="h-4 w-auto" />
                </span>
              </AvatarFallback>
            </Avatar>
          </DialogTrigger>
          <TooltipContent side="bottom">Account</TooltipContent>
        </Tooltip>
        <DialogContent className="flex h-[min(37.6875rem,calc(100vh-4rem))] w-[min(56.6875rem,calc(100vw-2rem))] max-w-[56.6875rem] flex-col gap-0 overflow-hidden rounded-[24px] p-0 shadow-[0_8px_24px_rgba(0,0,0,0.16)] sm:max-w-[56.6875rem]">
          <DialogHeader className="flex h-14 w-full shrink-0 flex-row items-center gap-0 px-4 pr-12">
            <DialogTitle>Account</DialogTitle>
            <DialogDescription className="sr-only">Manage your account, projects, and settings.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="profile" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList variant="line" className="h-auto w-full items-end justify-start gap-5 overflow-visible rounded-none border-0 border-b bg-transparent p-0 px-4 pt-3 group-data-horizontal/tabs:h-auto">
              {accountTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="group/account-tab relative h-auto min-h-0 flex-none self-end overflow-visible rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-normal leading-[18px] text-muted-foreground shadow-none after:hidden hover:text-foreground data-active:bg-transparent data-active:text-muted-foreground data-active:shadow-none"
                >
                  {tab.label}
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-0.5 z-10 h-0.5 bg-primary opacity-0 group-data-active/account-tab:opacity-100" />
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1">
              {accountTabs.map((tab) => <TabsContent key={tab.value} value={tab.value} className="h-full min-h-[12rem]" />)}
            </div>
          </Tabs>
          {confirmSignOut ? (
            <div className="flex h-[3.8125rem] shrink-0 flex-col gap-3 border-t px-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">Are you sure you want to proceed with account sign out?</p>
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-[8.25rem] rounded-full border-border bg-transparent text-destructive hover:bg-transparent hover:text-destructive"
                  disabled={pending}
                  onClick={() => void signOut()}
                >
                  {pending ? "Signing out…" : "Yes, proceed"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-[8.25rem] rounded-full border-border bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
                  disabled={pending}
                  onClick={() => setConfirmSignOut(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-[3.8125rem] shrink-0 items-center justify-end border-t px-4">
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[6.25rem] rounded-full border-border bg-transparent text-destructive hover:bg-transparent hover:text-destructive"
                onClick={() => setConfirmSignOut(true)}
              >
                Sign out
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {error && <p role="alert" className="absolute right-0 top-full mt-2 text-sm text-destructive">Could not sign out. Please try again.</p>}
    </div>
  )
}
