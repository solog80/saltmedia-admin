"use client"

import { useEffect, useRef, useState } from "react"
import { Folder, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Check, FolderPlus, Trash2, Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface MediaItem {
  name: string
  path: string
  isFolder: boolean
  url?: string
  sizeBytes?: number
}

function formatBytes(n?: number | null): string {
  if (!n) return ""
  const units = ["B", "KB", "MB", "GB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export default function MediaLibraryDialog({
  open,
  onClose,
  onSelect,
  scope = "news",
  title = "Media library",
}: {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  scope?: string
  title?: string
}) {
  const [folder, setFolder] = useState("")
  const [items, setItems] = useState<MediaItem[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingPath, setDeletingPath] = useState("")
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setFolder("")
      setSelected(null)
    }
  }, [open])

  async function load(targetFolder: string, nextOffset: number, reset: boolean) {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ offset: String(nextOffset), scope })
      if (targetFolder) qs.set("folder", targetFolder)
      const res = await fetch(`/api/media/images?${qs.toString()}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load images")
      const list: MediaItem[] = data.images ?? []
      setItems((prev) => (reset ? list : [...prev, ...list]))
      setOffset(data.offset ?? nextOffset)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load images")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setItems([])
      setOffset(0)
      setSelected(null)
      load(folder, 0, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folder, scope])

  const crumbs = folder ? folder.split("/").filter(Boolean) : []
  const folderCount = items.filter((i) => i.isFolder).length
  const imageCount = items.length - folderCount

  async function handleMediaUpload(file: File) {
    setUploadingMedia(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("scope", scope)
      if (folder) fd.append("folder", folder)
      const res = await fetch("/api/media/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Upload failed")
      await load(folder, 0, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploadingMedia(false)
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    setDeletingPath(item.path)
    setError(null)
    try {
      const res = await fetch(`/api/media/images?scope=${encodeURIComponent(scope)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: item.path }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to delete image")
      setSelected((prev) => (prev?.path === item.path ? null : prev))
      await load(folder, 0, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete image")
    } finally {
      setDeletingPath("")
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const fullPath = folder ? `${folder}/${name}` : name
      const res = await fetch("/api/media/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, folder: fullPath }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to create folder")
      setCreatingFolder(false)
      setNewFolderName("")
      await load(folder, 0, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex flex-col overflow-hidden border border-white/10 bg-neutral-900 p-0 text-white max-w-none w-[calc(100vw-1rem)] h-[calc(100vh-1rem)] sm:w-[80vw] sm:h-[45vw] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-2rem)]"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/10 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
              disabled={!folder}
              onClick={() => setFolder(crumbs.slice(0, -1).join("/"))}
            >
              <ChevronLeft size={14} />
              Back
            </Button>
            {creatingFolder ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  placeholder={`Folder name${folder ? ` in /${folder}` : ""}`}
                  className="h-8 w-36 sm:w-44 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-blue-500"
                />
                <Button size="sm" className="h-8 bg-blue-600 text-white hover:bg-blue-700" onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
                  {creating ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  Create
                </Button>
                <Button variant="outline" size="sm" className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => { setCreatingFolder(false); setNewFolderName("") }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setCreatingFolder(true)}
                >
                  <FolderPlus size={14} />
                  <span className="hidden sm:inline">New folder</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleMediaUpload(file)
                    e.target.value = ""
                  }}
                />
              </>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
              <button
                type="button"
                className="shrink-0 rounded px-1.5 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
                onClick={() => setFolder("")}
              >
                {scope}
              </button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex shrink-0 items-center gap-1">
                  <ChevronRight size={12} className="text-white/30" />
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => setFolder(crumbs.slice(0, i + 1).join("/"))}
                  >
                    {c}
                  </button>
                </span>
              ))}
            </div>
            {!loading && (
              <span className="shrink-0 text-xs text-white/40">
                {imageCount} image{imageCount === 1 ? "" : "s"}
                {folderCount > 0 && ` · ${folderCount} folder${folderCount === 1 ? "" : "s"}`}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {error && (
            <div className="mb-3 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {items.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ImageIcon size={26} className="text-white/30" />
              </div>
              <p className="text-sm">No images in this folder yet</p>
              <p className="mt-1 text-xs text-white/30">Use the Upload button to add one</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) =>
                item.isFolder ? (
                  <button
                    key={item.path}
                    type="button"
                    className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-white/25 hover:bg-white/10"
                    onClick={() => setFolder(item.path.replace(new RegExp(`^${scope}/?`), "").replace(/\/$/, ""))}
                  >
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-300/80 transition group-hover:scale-105">
                      <Folder size={22} />
                    </div>
                    <span className="max-w-full truncate px-2 sm:px-3 text-xs font-medium">{item.name}</span>
                  </button>
                ) : (
                  <div
                    key={item.path}
                    role="button"
                    tabIndex={0}
                    className={`group relative cursor-pointer overflow-hidden rounded-lg border transition ${
                      selected?.path === item.path
                        ? "border-blue-500 ring-2 ring-blue-500/40"
                        : "border-white/10 hover:border-white/25"
                    }`}
                    onClick={() => setSelected(selected?.path === item.path ? null : item)}
                  >
                    <div className="aspect-video w-full bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    {selected?.path === item.path && (
                      <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                        <Check size={12} />
                      </span>
                    )}
                    <button
                      type="button"
                      title="Delete image"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-red-400 opacity-0 transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item)
                      }}
                      disabled={deletingPath === item.path}
                    >
                      {deletingPath === item.path ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                    </button>
                    <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/60 px-2 py-1.5">
                      <span className="truncate text-[11px] text-white/70">{item.name}</span>
                      <span className="shrink-0 text-[10px] text-white/35">{formatBytes(item.sizeBytes)}</span>
                    </div>
                  </div>
                ),
              )}
              {loading && (
                <div className="col-span-full flex items-center justify-center py-8 text-white/50">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {selected ? (
              <>
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.url} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-white/80">{selected.name}</p>
                  <p className="text-[11px] text-white/40">{formatBytes(selected.sizeBytes)}</p>
                </div>
              </>
            ) : (
              <p className="text-xs text-white/40">Select an image to reuse it in the article</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 && (
              <Button variant="outline" size="sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => load(folder, offset, false)} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={14} /> : "Load more"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" className="gap-1 bg-blue-600 text-white hover:bg-blue-700" disabled={!selected} onClick={() => { if (selected) onSelect(selected.url || ""); onClose() }}>
              Insert image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
