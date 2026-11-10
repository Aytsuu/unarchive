import Image from "next/image"

export function BrandLogo({ compactOnSmallScreens = false }: { compactOnSmallScreens?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Image src="/assets/brand/u-a-fusion.svg" alt="" width={24} height={21} className="shrink-0" />
      <span className={compactOnSmallScreens ? "max-[360px]:sr-only" : undefined}>Unarchive</span>
    </span>
  )
}
