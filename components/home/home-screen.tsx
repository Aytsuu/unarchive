import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AccountMenu, type HomeUser } from "@/components/home/account-menu"
import searchIcon from "@/components/home/search.svg"

function ProjectCard() {
  return (
    <Card className="h-[170px] gap-2 rounded-[20px] border border-border p-5 ring-0">
      <CardHeader className="gap-2 p-0">
        <CardTitle>Card title</CardTitle>
        <CardDescription>Card description</CardDescription>
      </CardHeader>
      <CardContent className="p-0">Your content goes here.</CardContent>
    </Card>
  )
}

export function HomeScreen({ user }: { user: HomeUser | null }) {
  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground">
      <header className="flex h-[61px] items-center justify-between px-5 pt-[21px] sm:px-10">
        <Link href="/home" className="text-xl font-medium">Unarchive</Link>
        {user ? <AccountMenu user={user} /> : <span className={buttonVariants({ variant: "secondary", size: "sm", className: "w-[75px]" })}>Guest</span>}
      </header>

      <div className="mx-auto mt-[87px] flex w-[min(662px,calc(100%-40px))] items-center gap-[7px] sm:translate-x-10">
        <div className="relative min-w-0 flex-1">
          <Image src={searchIcon} alt="" className="pointer-events-none absolute left-[7px] top-1/2 -translate-y-1/2" />
          <Input aria-label="Search capstone projects" placeholder="Search from 11200 published capstone projects" className="bg-background pl-10" />
        </div>
        <Link href={user ? "/publish" : "/login"} className={buttonVariants()}>Publish</Link>
      </div>

      <div className="relative mx-auto mt-[63px] max-w-[1325px] px-5 sm:px-0">
        <div className="grid grid-cols-1 gap-[15px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: user ? 6 : 12 }, (_, index) => <ProjectCard key={index} />)}
        </div>
        {!user && (
          <div className="absolute inset-x-0 top-[260px] bottom-0 flex min-h-[300px] flex-col items-center bg-background/90 px-5 pt-[132px] text-center backdrop-blur-[2px]">
            <p className="text-sm font-medium leading-normal">Sign in to your account or to continue<br className="hidden sm:block" /> browsing and be able to publish your works.</p>
            <div className="mt-[30px] flex gap-[9px]">
              <Link href="/login" className={buttonVariants({ variant: "secondary", className: "w-[119px]" })}>Log in</Link>
              <Link href="/signup" className={buttonVariants({ className: "w-[119px]" })}>Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
