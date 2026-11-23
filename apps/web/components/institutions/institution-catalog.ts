"use client"

import { useQuery } from "@tanstack/react-query"

export type Institution = { id: string; name: string; region: string }

export function normalizeInstitution(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

export function useInstitutions() {
  return useQuery({
    queryKey: ["philippine-institutions"],
    staleTime: 60 * 60 * 1000,
    queryFn: async ({ signal }): Promise<Institution[]> => {
      const response = await fetch("/data/philippine-institutions.json", { signal })
      if (!response.ok) throw new Error("Unable to load institutions")
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error("Invalid institution directory")
      return data.filter((item): item is Institution => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string" && typeof item.region === "string"))
    },
  })
}
