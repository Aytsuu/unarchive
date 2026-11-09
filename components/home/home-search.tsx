"use client"

import { SearchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { HomeProject } from "@/components/home/home-screen"
import searchIcon from "@/components/home/search.svg"

export function HomeSearch({ search, projects, className }: { search: string; projects: HomeProject[]; className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(search)
  const trimmed = query.trim()
  const matchingProjects = projects.filter((project) => project.title.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 8)

  function changeOpen(next: boolean) {
    if (next) setQuery(search)
    setOpen(next)
  }

  function searchAll() {
    const params = new URLSearchParams()
    if (trimmed) params.set("q", trimmed)
    setOpen(false)
    router.push(params.size ? `/home?${params}` : "/home")
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon" className={className} aria-label="Search projects" />}>
        <Image src={searchIcon} alt="" className="size-4" />
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-2">
        <DialogHeader className="sr-only">
          <DialogTitle>Search projects</DialogTitle>
          <DialogDescription>Search published projects by title.</DialogDescription>
        </DialogHeader>
        <Command label="Search project titles" shouldFilter={false}>
          <CommandInput autoFocus aria-label="Search project titles" placeholder="Search projects..." value={query} onValueChange={setQuery} maxLength={100} />
          <CommandList>
            <CommandGroup heading="Search">
              <CommandItem value="search-all" onSelect={searchAll}>
                <HugeiconsIcon icon={SearchIcon} aria-hidden="true" />
                <span className="truncate">{trimmed ? `Search all projects for “${trimmed}”` : "Browse all projects"}</span>
              </CommandItem>
            </CommandGroup>
            {matchingProjects.length > 0 && <CommandGroup heading="Currently shown projects">
              {matchingProjects.map((project) => <CommandItem key={project.id} value={`project-${project.id}`} onSelect={() => { setOpen(false); router.push(`/projects/${project.id}`) }}>
                <span className="truncate">{project.title}</span>
              </CommandItem>)}
            </CommandGroup>}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
