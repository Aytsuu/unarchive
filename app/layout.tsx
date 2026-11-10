import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevAutofillToolbar } from "@/components/dev-tools/autofill-toolbar";

const googleSans = localFont({
  src: "./fonts/google-sans-latin.woff2",
  variable: "--font-google-sans",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unarchive",
  description: "",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      style={{ colorScheme: "light" }}
      className={cn("h-full", "antialiased", googleSans.variable, geistMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col"><TooltipProvider>{children}{process.env.NODE_ENV === "development" && <DevAutofillToolbar />}</TooltipProvider></body>
    </html>
  );
}
