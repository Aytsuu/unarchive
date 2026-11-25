import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import { QueryProvider } from "@/components/query-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "../../web/app/globals.css"

const googleSans = localFont({
  src: "../../web/app/fonts/google-sans-latin.woff2",
  variable: "--font-google-sans",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Moderation · Unarchive",
  description: "Review projects submitted for publication.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: "light" }} className={`${googleSans.variable} ${geistMono.variable} h-full font-sans antialiased`}>
      <body className="min-h-full bg-background text-foreground"><QueryProvider><TooltipProvider>{children}</TooltipProvider></QueryProvider></body>
    </html>
  )
}
