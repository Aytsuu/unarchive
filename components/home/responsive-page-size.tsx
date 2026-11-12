"use client"

import { useEffect } from "react"
import { pageSizeForWidth } from "@/lib/projects/listing-viewport.mjs"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function ResponsivePageSize({ pageSize }: { pageSize: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    function updatePageSize() {
      const size = pageSizeForWidth(window.innerWidth)
      if (size === pageSize) return
      const params = new URLSearchParams(searchParams.toString())
      params.set("size", String(size))
      params.delete("page")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    updatePageSize()
    window.addEventListener("resize", updatePageSize)
    return () => window.removeEventListener("resize", updatePageSize)
  }, [pageSize, pathname, router, searchParams])
  return null
}
