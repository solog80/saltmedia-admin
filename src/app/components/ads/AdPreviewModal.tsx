"use client"

import React, { useRef, useEffect } from "react"
import { X, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Ad {
  id: string
  adName: string
  adType: "manual" | "vast"
  creativeType?: "image" | "video"
  creativeUrl?: string
  thumbnailUrl?: string
  vastTagUrl?: string
  durationSeconds?: number
  landingPageUrl?: string
  status: string
  priority: number
}

interface AdPreviewModalProps {
  ad: Ad | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdPreviewModal({ ad, open, onOpenChange }: AdPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let hls: any = null
    let isCleaningUp = false

    const loadVideo = async () => {
      if (!videoRef.current || !ad || isCleaningUp) return

      const src = ad.creativeUrl
      if (!src) return

      if (src.endsWith(".m3u8")) {
        try {
          const Hls = (await import("hls.js")).default
          if (Hls.isSupported()) {
            hls = new Hls()
            hls.loadSource(src)
            hls.attachMedia(videoRef.current)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current?.play().catch(() => {})
            })
          }
        } catch (e) {
          console.error("Failed to load HLS:", e)
        }
      } else {
        videoRef.current.src = src
        videoRef.current.play().catch(() => {})
      }
    }

    if (open) {
      loadVideo()
    }

    return () => {
      isCleaningUp = true
      try {
        if (hls) {
          hls.destroy()
        }
      } catch (e) {
        console.error("Error cleaning up HLS:", e)
      }
      if (videoRef.current) {
        videoRef.current.src = ""
        videoRef.current.pause()
      }
    }
  }, [ad, open])

  if (!ad) return null

  const isVideo = ad.creativeType === "video" || ad.creativeUrl?.includes(".m3u8")
  const isImage = ad.creativeType === "image" || ad.creativeUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false)
      }}
    >
      <div className="relative w-full max-w-4xl mx-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-lg overflow-hidden border border-white/10 shadow-2xl">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6 p-6">
          {/* Preview Area */}
          <div className="relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center group">
            {ad.adType === "vast" ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-4 text-base">
                    VAST Programmatic
                  </Badge>
                  <p className="text-sm text-white/60 mb-3">VAST Tag URL</p>
                  <p className="text-xs text-white/40 break-all font-mono">{ad.vastTagUrl}</p>
                </div>
              </div>
            ) : isVideo ? (
              <div className="relative w-full h-full">
                {ad.thumbnailUrl && (
                  <img
                    src={ad.thumbnailUrl}
                    alt={ad.adName}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
                <video
                  ref={videoRef}
                  controls
                  className="relative w-full h-full object-contain bg-black z-10"
                  playsInline
                  controlsList="nodownload"
                />
              </div>
            ) : isImage ? (
              <img
                src={ad.creativeUrl}
                alt={ad.adName}
                className="w-full h-full object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div className="text-center">
                <p className="text-white/60 mb-3">No preview available</p>
                {ad.creativeUrl && (
                  <a
                    href={ad.creativeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    Open in new tab →
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Ad Details */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">{ad.adName}</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Type</p>
                <Badge variant={ad.adType === "vast" ? "secondary" : "outline"}>
                  {ad.adType.toUpperCase()}
                </Badge>
              </div>

              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Status</p>
                <Badge
                  variant={
                    ad.status === "active"
                      ? "default"
                      : ad.status === "inactive"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {ad.status}
                </Badge>
              </div>

              {ad.durationSeconds && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Duration</p>
                  <p className="text-white font-semibold">{ad.durationSeconds}s</p>
                </div>
              )}

              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Priority</p>
                <p className="text-white font-semibold">{ad.priority}</p>
              </div>

              {ad.creativeType && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Creative Type</p>
                  <p className="text-white capitalize font-semibold">{ad.creativeType}</p>
                </div>
              )}

              {ad.landingPageUrl && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 md:col-span-3">
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Landing Page</p>
                  <a
                    href={ad.landingPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs break-all"
                  >
                    {ad.landingPageUrl}
                  </a>
                </div>
              )}
            </div>

            <p className="text-xs text-white/50">Press ESC or click outside to close</p>
          </div>
        </div>
      </div>
    </div>
  )
}
