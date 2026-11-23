"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { Button, buttonVariants } from "@/components/ui/button"

type SavePayload = { data?: { saved?: unknown } }

async function readSaved(response: Response): Promise<boolean> {
  if (!response.ok) throw new Error("Unable to update saved projects.")
  const payload: SavePayload = await response.json()
  if (typeof payload.data?.saved !== "boolean") throw new Error("Unable to update saved projects.")
  return payload.data.saved
}

function SaveGlyph({ saved }: { saved: boolean }) {
  return <span aria-hidden="true" className={`block h-3.5 w-3 bg-current mask-contain mask-center mask-no-repeat ${saved ? "text-[#FFE100] mask-[url('/assets/icons/bookmark-save-filled.svg')]" : "mask-[url('/assets/icons/bookmark-save.svg')] text-foreground"}`} />
}

function GuestSaveLink({ title, compact }: { title: string; compact: boolean }) {
  return (
    <Link href="/login" aria-label={`Save ${title}`} title={`Save ${title}`} className={cn(buttonVariants({ size: compact ? "icon-xs" : "icon", variant: "outline" }), compact ? "size-7 border border-border" : "border-border")}>
      <SaveGlyph saved={false} />
    </Link>
  )
}

export function ProjectSaveButton({ projectId, title, scope, initialSaved, compact = false }: { projectId: string; title: string; scope: string; initialSaved?: boolean; compact?: boolean }) {
  if (scope === "guest") return <GuestSaveLink title={title} compact={compact} />
  return <AuthenticatedSaveButton projectId={projectId} title={title} scope={scope} initialSaved={initialSaved} compact={compact} />
}

function AuthenticatedSaveButton({ projectId, title, scope, initialSaved, compact }: { projectId: string; title: string; scope: string; initialSaved?: boolean; compact: boolean }) {
  const queryClient = useQueryClient()
  const key = ["project-saved", scope, projectId] as const
  const query = useQuery({
    queryKey: key,
    initialData: initialSaved,
    staleTime: 15_000,
    queryFn: async ({ signal }) => readSaved(await fetch(`/api/projects/${projectId}/saved`, { signal, cache: "no-store" })),
  })
  const mutation = useMutation({
    mutationFn: async (wasSaved: boolean) => readSaved(await fetch(`/api/projects/${projectId}/saved`, { method: wasSaved ? "DELETE" : "PUT" })),
    onMutate: async (wasSaved) => {
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData(key, !wasSaved)
      return wasSaved
    },
    onError: (_error, _wasSaved, previous) => { queryClient.setQueryData(key, previous) },
    onSuccess: (saved) => { queryClient.setQueryData(key, saved) },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ["saved-projects", scope] })
      void queryClient.invalidateQueries({ queryKey: ["project-list", scope] })
    },
  })
  const saved = query.data === true
  const label = query.isError ? `Retry loading saved status for ${title}` : saved ? `Remove ${title} from saved projects` : `Save ${title}`
  return <span className="inline-flex flex-col items-end gap-1">
    <Button type="button" size={compact ? "icon-xs" : "icon"} variant={saved ? "secondary" : "outline"} aria-label={label} aria-pressed={saved} title={label} disabled={query.isPending || mutation.isPending} onClick={() => query.isError ? void query.refetch() : mutation.mutate(saved)} className={compact ? "size-7 border border-border" : "border-border"}>
      <SaveGlyph saved={saved} />
    </Button>
    {(query.isError || mutation.isError) && <span role="alert" className="max-w-40 text-right text-xs text-destructive">Could not update saved project.</span>}
  </span>
}
