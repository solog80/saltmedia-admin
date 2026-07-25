"use client"

import React, { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BunnyCDNCollection {
  guid: string
  name: string
}

interface BunnyCDNVideo {
  guid: string
  title: string
  thumbnailUrl?: string
  length?: number
}

interface BunnyVideoSelectorProps {
  selectedVideoUrl?: string
  onVideoSelect: (videoUrl: string, videoId: string, duration?: number, thumbnailUrl?: string) => void
}

export function BunnyVideoSelector({ selectedVideoUrl, onVideoSelect }: BunnyVideoSelectorProps) {
  const [selectedCollection, setSelectedCollection] = useState<string>("")
  const [pullZoneDomain, setPullZoneDomain] = useState<string>("")

  // Fetch collections
  const { data: collections = [], isLoading: isLoadingCollections, error: collectionsError } = useQuery({
    queryKey: ["bunny-collections"],
    queryFn: async () => {
      const response = await fetch(`/api/bunny/collections`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to fetch collections")
      }
      const data = await response.json()
      setPullZoneDomain(data.pullZoneDomain || "")
      return data.collections || []
    },
  })

  // Fetch videos from selected collection
  const { data: videos = [], isLoading: isLoadingVideos, error: videosError } = useQuery({
    queryKey: ["bunny-videos", selectedCollection],
    queryFn: async () => {
      if (!selectedCollection) return []
      const response = await fetch(`/api/bunny/videos?collectionId=${selectedCollection}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to fetch videos from this collection")
      }
      const data = await response.json()
      setPullZoneDomain(data.pullZoneDomain || "")
      return data.videos || []
    },
    enabled: !!selectedCollection,
  })

  return (
    <Card className="frosted-glass border bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border-cyan-500/30">
      <CardHeader>
        <CardTitle className="text-base">Select from Bunny</CardTitle>
        <CardDescription>Choose a video from your Bunny CDN library</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {collectionsError && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load collections. Make sure Bunny API is configured.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="collection">Collection</Label>
          <Select value={selectedCollection} onValueChange={setSelectedCollection}>
            <SelectTrigger className="bg-white/5 border-white/10">
              {isLoadingCollections ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading collections...
                </div>
              ) : (
                <SelectValue placeholder="Select a collection..." />
              )}
            </SelectTrigger>
            <SelectContent>
              {collections.map((collection: BunnyCDNCollection) => (
                <SelectItem key={collection.guid} value={collection.guid}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCollection && (
          <div className="space-y-2">
            <Label htmlFor="video">Video</Label>
            <Select
              onValueChange={(videoId) => {
                const video = videos.find((v: BunnyCDNVideo) => v.guid === videoId)
                if (video && pullZoneDomain) {
                  // Use the pull zone domain for CDN URLs
                  const videoUrl = `https://${pullZoneDomain}/${videoId}/playlist.m3u8`
                  // Bunny returns duration in seconds, keep it as-is
                  const duration = video.length ? Math.round(video.length) : undefined
                  // Construct thumbnail URL from pull zone
                  const thumbnailUrl = `https://${pullZoneDomain}/${videoId}/thumbnail.jpg`
                  onVideoSelect(videoUrl, videoId, duration, thumbnailUrl)
                }
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10">
                {isLoadingVideos ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading videos...
                  </div>
                ) : (
                  <SelectValue placeholder="Select a video..." />
                )}
              </SelectTrigger>
              <SelectContent>
                {videos.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No videos in this collection</div>
                ) : (
                  videos.map((video: BunnyCDNVideo) => {
                    const durationText = video.length
                      ? video.length >= 60
                        ? `${Math.floor(video.length / 60)}m ${video.length % 60}s`
                        : `${video.length}s`
                      : ""
                    return (
                      <SelectItem key={video.guid} value={video.guid}>
                        {video.title} {durationText && `(${durationText})`}
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {videosError && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {videosError instanceof Error ? videosError.message : "Failed to load videos from this collection"}
            </AlertDescription>
          </Alert>
        )}

        {selectedVideoUrl && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-sm text-green-300">
              ✓ Video selected and URL populated
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
