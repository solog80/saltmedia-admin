"use client"

import React, { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adsApi } from "@/lib/api/ads"
import { BunnyVideoSelector } from "./BunnyVideoSelector"

interface Ad {
  id?: string
  adName: string
  adType: "manual" | "vast"
  status: "active" | "inactive" | "pending"
  placementType: string[]
  targetingRules?: {
    country?: string[]
    userSegment?: string[]
    contentType?: string[]
  }
  creativeUrl?: string
  creativeType?: "image" | "video"
  thumbnailUrl?: string
  landingPageUrl?: string
  durationSeconds?: number
  vastTagUrl?: string
  vastWrapperLimit?: number
  startDate: Date
  endDate: Date
  priority: number
  frequencyCap?: {
    perUser?: number
    perPeriod?: "24h" | "7d"
  }
  midRollTriggerType?: "percentage" | "timestamp"
  midRollTriggerValue?: number
}

interface AdFormProps {
  ad?: Ad
  onSuccess: () => void | Promise<void>
}

const PLACEMENTS = ["pre-roll", "mid-roll", "banner"]
const AD_TYPES = ["manual", "vast"]
const STATUSES = ["active", "inactive", "pending"]
const CONTENT_TYPES = ["liveTV", "ondemand", "all"]
const USER_SEGMENTS = ["all", "free", "premium"]

export function AdForm({ ad, onSuccess }: AdFormProps) {
  const [formData, setFormData] = useState<Ad>(
    ad || {
      adName: "",
      adType: "manual",
      status: "pending",
      placementType: [],
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      priority: 1,
      frequencyCap: {
        perUser: 5,
        perPeriod: "24h",
      },
      targetingRules: {
        contentType: ["all"],
        userSegment: ["all"],
      },
    }
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  const createAdMutation = useMutation({
    mutationFn: async (data: Ad) => {
      if (ad?.id) {
        return await adsApi.updateAd(ad.id, data)
      } else {
        return await adsApi.createAd(data)
      }
    },
    onSuccess: onSuccess,
    onError: (error: any) => {
      setErrors({ submit: error.message || "Failed to save ad" })
    },
  })

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.adName.trim()) {
      newErrors.adName = "Ad name is required"
    }
    if (formData.placementType.length === 0) {
      newErrors.placementType = "At least one placement must be selected"
    }
    if (formData.adType === "manual") {
      if (!formData.creativeUrl?.trim()) {
        newErrors.creativeUrl = "Creative URL is required for manual ads"
      }
      if (!formData.durationSeconds || formData.durationSeconds <= 0) {
        newErrors.durationSeconds = "Duration must be greater than 0"
      }
    }
    if (formData.adType === "vast") {
      if (!formData.vastTagUrl?.trim()) {
        newErrors.vastTagUrl = "VAST tag URL is required for VAST ads"
      }
    }
    if (formData.startDate >= formData.endDate) {
      newErrors.dates = "End date must be after start date"
    }
    if (formData.placementType.includes("mid-roll")) {
      const type = formData.midRollTriggerType || "percentage"
      const val = formData.midRollTriggerValue
      if (val === undefined || isNaN(val) || val <= 0) {
        newErrors.midRollTriggerValue = "Trigger value must be greater than 0"
      } else if (type === "percentage" && val >= 100) {
        newErrors.midRollTriggerValue = "Percentage must be less than 100"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      createAdMutation.mutate(formData)
    }
  }

  const togglePlacement = (placement: string) => {
    setFormData((prev) => ({
      ...prev,
      placementType: prev.placementType.includes(placement)
        ? prev.placementType.filter((p) => p !== placement)
        : [...prev.placementType, placement],
    }))
  }

  const toggleContentType = (contentType: string) => {
    setFormData((prev) => ({
      ...prev,
      targetingRules: {
        ...prev.targetingRules,
        contentType: prev.targetingRules?.contentType?.includes(contentType)
          ? prev.targetingRules.contentType.filter((c) => c !== contentType)
          : [...(prev.targetingRules?.contentType || []), contentType],
      },
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.submit && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="creative">Creative</TabsTrigger>
          <TabsTrigger value="targeting">Targeting</TabsTrigger>
        </TabsList>

        {/* Basic Tab */}
        <TabsContent value="basic" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adName">Ad Name *</Label>
            <Input
              id="adName"
              value={formData.adName}
              onChange={(e) => setFormData({ ...formData, adName: e.target.value })}
              placeholder="e.g., Summer Sale Campaign"
              className={errors.adName ? "border-red-500" : ""}
            />
            {errors.adName && <p className="text-xs text-red-500">{errors.adName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adType">Ad Type *</Label>
              <Select value={formData.adType} onValueChange={(value: any) => setFormData({ ...formData, adType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "vast" ? "VAST (Programmatic)" : "Manual (Direct)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Placements *</Label>
            <div className="border border-blue-500/30 rounded-lg p-4 space-y-2 bg-white/5">
              {PLACEMENTS.map((placement) => (
                <div key={placement} className="flex items-center gap-2">
                  <Checkbox
                    id={placement}
                    checked={formData.placementType.includes(placement)}
                    onCheckedChange={() => togglePlacement(placement)}
                  />
                  <Label htmlFor={placement} className="font-normal cursor-pointer">
                    {placement.charAt(0).toUpperCase() + placement.slice(1)}
                  </Label>
                </div>
              ))}
            </div>
            {errors.placementType && <p className="text-xs text-red-500">{errors.placementType}</p>}
          </div>

          {formData.placementType.includes("mid-roll") && (
            <div className="border border-blue-500/30 rounded-lg p-4 space-y-4 bg-blue-500/5">
              <h4 className="font-medium text-sm text-blue-400">Mid-Roll Trigger Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="midRollTriggerType">Trigger Type *</Label>
                  <Select
                    value={formData.midRollTriggerType || "percentage"}
                    onValueChange={(value: "percentage" | "timestamp") =>
                      setFormData({
                        ...formData,
                        midRollTriggerType: value,
                        midRollTriggerValue: value === "percentage" ? 50 : 30,
                      })
                    }
                  >
                    <SelectTrigger id="midRollTriggerType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Progress (%)</SelectItem>
                      <SelectItem value="timestamp">Absolute Timestamp (Seconds)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="midRollTriggerValue">
                    {formData.midRollTriggerType === "timestamp"
                      ? "Trigger Time (Seconds) *"
                      : "Trigger Percentage (1-99%) *"}
                  </Label>
                  <Input
                    id="midRollTriggerValue"
                    type="number"
                    min={1}
                    max={formData.midRollTriggerType === "timestamp" ? undefined : 99}
                    value={formData.midRollTriggerValue ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        midRollTriggerValue: parseInt(e.target.value) || 0,
                      })
                    }
                    className={errors.midRollTriggerValue ? "border-red-500" : ""}
                  />
                  {errors.midRollTriggerValue && (
                    <p className="text-xs text-red-500">{errors.midRollTriggerValue}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Higher priority ads are served first</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate.toISOString().split("T")[0]}
                onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate.toISOString().split("T")[0]}
                onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })}
              />
            </div>
          </div>
          {errors.dates && <p className="text-xs text-red-500">{errors.dates}</p>}
        </TabsContent>

        {/* Creative Tab */}
        <TabsContent value="creative" className="space-y-4">
          {formData.adType === "manual" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="creativeType">Creative Type *</Label>
                <Select value={formData.creativeType || "image"} onValueChange={(value: any) => setFormData({ ...formData, creativeType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.creativeType === "video" && (
                <BunnyVideoSelector
                  selectedVideoUrl={formData.creativeUrl}
                  onVideoSelect={(videoUrl, videoId, duration, thumbnailUrl) => {
                    setFormData({
                      ...formData,
                      creativeUrl: videoUrl,
                      ...(duration && { durationSeconds: duration }),
                      ...(thumbnailUrl && { thumbnailUrl })
                    })
                  }}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="creativeUrl">Creative URL *</Label>
                <Input
                  id="creativeUrl"
                  type="url"
                  value={formData.creativeUrl || ""}
                  onChange={(e) => setFormData({ ...formData, creativeUrl: e.target.value })}
                  placeholder={formData.creativeType === "video" ? "Auto-populated from Bunny selection..." : "https://bunny.net/..."}
                  className={errors.creativeUrl ? "border-red-500" : ""}
                />
                {errors.creativeUrl && <p className="text-xs text-red-500">{errors.creativeUrl}</p>}
                <p className="text-xs text-muted-foreground">
                  {formData.creativeType === "video"
                    ? "URL will be auto-populated when you select a video from Bunny"
                    : "URL to the ad creative hosted on Bunny CDN"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationSeconds">Duration (seconds) *</Label>
                <Input
                  id="durationSeconds"
                  type="number"
                  min="1"
                  value={formData.durationSeconds || ""}
                  onChange={(e) => setFormData({ ...formData, durationSeconds: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 15"
                  className={errors.durationSeconds ? "border-red-500" : ""}
                />
                {errors.durationSeconds && <p className="text-xs text-red-500">{errors.durationSeconds}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="landingPageUrl">Landing Page URL</Label>
                <Input
                  id="landingPageUrl"
                  type="url"
                  value={formData.landingPageUrl || ""}
                  onChange={(e) => setFormData({ ...formData, landingPageUrl: e.target.value })}
                  placeholder="https://example.com/campaign"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="vastTagUrl">VAST Tag URL *</Label>
                <Textarea
                  id="vastTagUrl"
                  value={formData.vastTagUrl || ""}
                  onChange={(e) => setFormData({ ...formData, vastTagUrl: e.target.value })}
                  placeholder="https://adserver.com/vast?..."
                  className={errors.vastTagUrl ? "border-red-500" : ""}
                  rows={4}
                />
                {errors.vastTagUrl && <p className="text-xs text-red-500">{errors.vastTagUrl}</p>}
                <p className="text-xs text-muted-foreground">VAST 2.0/3.0 tag URL for programmatic ads</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vastWrapperLimit">VAST Wrapper Limit</Label>
                <Input
                  id="vastWrapperLimit"
                  type="number"
                  min="1"
                  value={formData.vastWrapperLimit || "5"}
                  onChange={(e) => setFormData({ ...formData, vastWrapperLimit: parseInt(e.target.value) || 5 })}
                />
                <p className="text-xs text-muted-foreground">Maximum number of VAST wrapper redirects allowed</p>
              </div>
            </>
          )}
        </TabsContent>

        {/* Targeting Tab */}
        <TabsContent value="targeting" className="space-y-4">
          <Card className="frosted-glass border bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-base">Content Type Targeting</CardTitle>
              <CardDescription>Select which content types this ad should appear on</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="border border-blue-500/20 rounded-lg p-4 space-y-2 bg-white/5">
                {CONTENT_TYPES.map((contentType) => (
                  <div key={contentType} className="flex items-center gap-2">
                    <Checkbox
                      id={`content-${contentType}`}
                      checked={formData.targetingRules?.contentType?.includes(contentType) || false}
                      onCheckedChange={() => toggleContentType(contentType)}
                    />
                    <Label htmlFor={`content-${contentType}`} className="font-normal cursor-pointer">
                      {contentType === "liveTV" ? "Live TV" : contentType === "ondemand" ? "On-Demand" : "All"}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="frosted-glass border bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30">
            <CardHeader>
              <CardTitle className="text-base">Frequency Capping</CardTitle>
              <CardDescription>Limit how often users see this ad</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequencyCapPerUser">Per User</Label>
                <Input
                  id="frequencyCapPerUser"
                  type="number"
                  min="1"
                  value={formData.frequencyCap?.perUser || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      frequencyCap: {
                        ...formData.frequencyCap,
                        perUser: parseInt(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequencyCapPeriod">Period</Label>
                <Select
                  value={formData.frequencyCap?.perPeriod || "24h"}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      frequencyCap: {
                        ...formData.frequencyCap,
                        perPeriod: value,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Per 24 Hours</SelectItem>
                    <SelectItem value="7d">Per 7 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button variant="outline" type="button">
          Cancel
        </Button>
        <Button type="submit" disabled={createAdMutation.isPending}>
          {createAdMutation.isPending
            ? "Saving..."
            : ad
              ? "Update Advertisement"
              : "Create Advertisement"}
        </Button>
      </div>
    </form>
  )
}