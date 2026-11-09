"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, type ChangeEvent, type DragEvent } from "react"
import { Button } from "@/components/ui/button"

type DemoUploaderProps = {
  photos: File[]
  onPhotosChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onRemove: (index: number) => void
}

function DemoThumbnail({ photo, onRemove }: { photo: File; onRemove: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(photo)
    const image = imageRef.current
    if (image) image.src = url
    return () => {
      image?.removeAttribute("src")
      URL.revokeObjectURL(url)
    }
  }, [photo])

  return (
    <li data-uploaded-name={photo.name} className="relative size-12.5 shrink-0">
      {/* Blob URLs provide temporary local previews of the selected images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imageRef} alt={`Preview of ${photo.name}`} className="size-full rounded-[10px] object-cover" />
      <Button type="button" variant="secondary" size="icon-xs" aria-label={`Remove ${photo.name}`} onClick={onRemove} className="absolute -right-1 -top-1 z-10 size-5 border border-border shadow-sm">
        <HugeiconsIcon icon={Cancel01Icon} size={12} aria-hidden="true" />
      </Button>
    </li>
  )
}

function AddIcon() {
  return <span aria-hidden="true" className="relative block size-6">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/assets/icons/publish/add-vertical.svg" alt="" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/assets/icons/publish/add-horizontal.svg" alt="" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
  </span>
}

export function DemoUploader({ photos, onPhotosChange, onDrop, onRemove }: DemoUploaderProps) {
  return (
    <div data-demo-uploader onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className={`mt-3.75 min-h-40 rounded-[20px] border border-border ${photos.length ? "p-3.5" : "border-dashed"}`}>
      {photos.length > 0 ? (
        <ul className="flex flex-wrap items-start gap-1.25">
          {photos.map((photo, index) => <DemoThumbnail key={`${photo.name}-${index}`} photo={photo} onRemove={() => onRemove(index)} />)}
          {photos.length < 5 && <li>
            <label className="flex size-12.5 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-border focus-within:outline-2 focus-within:outline-ring">
              <input type="file" accept="image/png,image/jpeg" multiple aria-label="Add demo images" className="sr-only" onChange={onPhotosChange} />
              <AddIcon />
            </label>
          </li>}
        </ul>
      ) : (
        <label className="flex min-h-39.5 cursor-pointer flex-col items-center justify-center gap-2 p-5 text-center focus-within:outline-2 focus-within:outline-ring">
          <input type="file" accept="image/png,image/jpeg" multiple aria-label="Upload demo images" className="sr-only" onChange={onPhotosChange} />
          <span className="text-base font-medium">Drop or upload a photo</span>
          <span className="text-sm text-muted-foreground">png, jpeg, jpg</span>
        </label>
      )}
    </div>
  )
}
