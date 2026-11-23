"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export function ProjectWithdraw({ projectId, disabled = false }: { projectId: string; disabled?: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const busy = useRef(false)

  async function withdraw() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError("")
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Unable to withdraw this project. Please try again.")
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["project-list"] }), queryClient.invalidateQueries({ queryKey: ["project-statistics"] })])
      setOpen(false)
      router.replace(`/projects/${projectId}`)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to withdraw this project. Please try again.")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return <AlertDialog open={open} onOpenChange={(next) => { if (!busy.current) { setOpen(next); if (!next) setError("") } }}>
    <AlertDialogTrigger render={<Button variant="outline" disabled={disabled}>Withdraw project</Button>} />
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Withdraw this project?</AlertDialogTitle><AlertDialogDescription>All versions and their demos will no longer be publicly available. The project cannot be restored from the app. Existing links will indicate that it was withdrawn.</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction type="button" variant="destructive" disabled={pending} onClick={withdraw}>{pending ? "Withdrawing..." : "Withdraw project"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
