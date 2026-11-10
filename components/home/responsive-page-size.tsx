"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function ResponsivePageSize({ pageSize }: { pageSize: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    function updatePageSize() {
      const width = window.innerWidth
      const size = width >= 1280 ? 12 : width >= 1024 ? 9 : width >= 640 ? 6 : 3
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
