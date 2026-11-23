"use client"

import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query"
import type { ReactNode } from "react"

let browserClient: QueryClient | undefined
function getClient() {
  if (isServer) return new QueryClient()
  return browserClient ??= new QueryClient()
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getClient()}>{children}</QueryClientProvider>
}
