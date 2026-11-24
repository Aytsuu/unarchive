import Image from "next/image"
import { cn } from "@/lib/utils"

export function BrandLogo({
  compactOnSmallScreens = false,
  showWordmark = true,
  markWidth = 24,
  markHeight = 21,
  className,
  markClassName,
  wordmarkClassName,
  wordmarkHidden = false,
}: {
  compactOnSmallScreens?: boolean
  showWordmark?: boolean
  markWidth?: number
  markHeight?: number
  className?: string
  markClassName?: string
  wordmarkClassName?: string
  wordmarkHidden?: boolean
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Image src="/assets/brand/u-a-fusion.svg" alt="" width={markWidth} height={markHeight} className={cn("shrink-0", markClassName)} />
      {showWordmark ? (
        <span aria-hidden={wordmarkHidden || undefined} className={cn(compactOnSmallScreens && "max-[360px]:sr-only", wordmarkClassName)}>
          Unarchive
        </span>
      ) : null}
    </span>
  )
}
