"use client"

import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import MediaLibraryDialog from "@/app/components/news/MediaLibraryDialog"

// Compact "Choose from library" button that opens the reusable media library
// scoped to a surface (e.g. "epg-programs", "events", "notifications") and
// hands the picked public URL to onSelect. Mirrors how news reuses images.
export default function LibraryImageButton({
  scope,
  label = "Choose from library",
  variant = "outline",
  onSelect,
}: {
  scope: string
  label?: string
  variant?: "outline" | "secondary"
  onSelect: (url: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant={variant} size="sm" className="w-full" onClick={() => setOpen(true)}>
        <ImageIcon size={14} className="mr-1.5" />
        {label}
      </Button>
      <MediaLibraryDialog
        open={open}
        scope={scope}
        onClose={() => setOpen(false)}
        onSelect={(url) => {
          onSelect(url)
          setOpen(false)
        }}
      />
    </>
  )
}
