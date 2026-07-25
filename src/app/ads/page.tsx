"use client"

import React, { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePagination } from "@/lib/pagination-helper"
import DateRangePicker from "@/app/components/DateRangePicker"
import { MetricCard } from "@/app/components/MetricCard"
import {
  Edit,
  Trash2,
  Plus,
  Search,
  Eye,
  MoreHorizontal,
  BarChart3,
  Video,
  Clock,
  TrendingUp,
} from "lucide-react"
import { AdForm } from "@/app/components/ads/AdForm"
import { AdAnalyticsDashboard } from "@/app/components/ads/AdAnalyticsDashboard"
import { AdPreviewModal } from "@/app/components/ads/AdPreviewModal"
import { adsApi } from "@/lib/api/ads"

interface Ad {
  id: string
  adName: string
  adType: "manual" | "vast"
  status: "active" | "inactive" | "pending"
  placementType: string[]
  creativeUrl?: string
  vastTagUrl?: string
  startDate: Date
  endDate: Date
  priority: number
  createdAt: Date
  updatedAt: Date
}

export default function AdsPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterPlacement, setFilterPlacement] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [adToEdit, setAdToEdit] = useState<Ad | undefined>(undefined)
  const [adToPreview, setAdToPreview] = useState<Ad | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("ads")

  const queryClient = useQueryClient()

  // Fetch ads
  const { data: adsData = [], isLoading: isAdsLoading, error: adsError } = useQuery({
    queryKey: ["ads"],
    queryFn: async () => {
      const response = await adsApi.getAllAds()
      return response || []
    },
  })

  // Fetch analytics
  const { data: analyticsData } = useQuery({
    queryKey: ["adAnalytics", dateRange],
    queryFn: async () => {
      return await adsApi.getAdAnalytics(dateRange.start, dateRange.end)
    },
  })

  // Delete ad mutation
  const deleteAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      return await adsApi.deleteAd(adId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads"] })
      setSuccess("Ad deleted successfully")
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (error: any) => {
      setError(error.message || "Failed to delete ad")
      setTimeout(() => setError(null), 5000)
    },
  })

  // Update ad status mutation
  const updateAdStatusMutation = useMutation({
    mutationFn: async ({ adId, status }: { adId: string; status: string }) => {
      return await adsApi.updateAdStatus(adId, status as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads"] })
      setSuccess("Ad status updated successfully")
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (error: any) => {
      setError(error.message || "Failed to update ad status")
      setTimeout(() => setError(null), 5000)
    },
  })

  // Filter ads
  const filteredAds = adsData.filter((ad: any) => {
    const matchesSearch =
      ad.adName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ad.creativeUrl?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesStatus = filterStatus === "all" || ad.status === filterStatus
    const matchesType = filterType === "all" || ad.adType === filterType
    const matchesPlacement =
      filterPlacement === "all" || (ad.placementType && ad.placementType.includes(filterPlacement))

    return matchesSearch && matchesStatus && matchesType && matchesPlacement
  })

  const { currentItems, currentPage, totalPages, setCurrentPage } = usePagination(filteredAds, 10)

  // Calculate metrics
  const totalAds = adsData.length || 0
  const activeAds = adsData.filter((ad: any) => ad.status === "active").length || 0
  const totalImpressions = analyticsData?.totalImpressions || 0
  const avgCTR = analyticsData?.avgCTR || 0

  const handleCreateAd = () => {
    setAdToEdit(undefined)
    setIsDialogOpen(true)
  }

  const handleEditAd = (ad: Ad) => {
    setAdToEdit(ad)
    setIsDialogOpen(true)
  }

  const handleDeleteAd = (adId: string) => {
    if (confirm("Are you sure you want to delete this ad? This action cannot be undone.")) {
      deleteAdMutation.mutate(adId)
    }
  }

  const handleAdFormSuccess = () => {
    setIsDialogOpen(false)
    setAdToEdit(undefined)
    queryClient.invalidateQueries({ queryKey: ["ads"] })
    setSuccess(adToEdit ? "Ad updated successfully" : "Ad created successfully")
    setTimeout(() => setSuccess(null), 3000)
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advertisements</h1>
          <p className="text-muted-foreground">
            Manage advertisements for mobile and web platforms. Track performance with real-time analytics.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Create Ad
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto frosted-glass border border-white/20">
            <DialogHeader>
              <DialogTitle>{adToEdit ? "Edit Advertisement" : "Create New Advertisement"}</DialogTitle>
              <DialogDescription>
                {adToEdit
                  ? "Update the advertisement details and settings."
                  : "Add a new advertisement to the system."}
              </DialogDescription>
            </DialogHeader>
            <AdForm ad={adToEdit} onSuccess={handleAdFormSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "ads" ? "default" : "outline"}
          className="flex items-center gap-2"
          onClick={() => setActiveTab("ads")}
        >
          <Video className="h-4 w-4" />
          Ads Management
        </Button>
        <Button
          variant={activeTab === "analytics" ? "default" : "outline"}
          className="flex items-center gap-2"
          onClick={() => setActiveTab("analytics")}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics
        </Button>
      </div>

      {/* Key Metrics - Only for ads management */}
      {activeTab === "ads" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Ads"
            value={isAdsLoading ? <Skeleton className="h-8 w-16" /> : totalAds.toString()}
            icon={<Video className="h-5 w-5" />}
            color="blue"
          />
          <MetricCard
            title="Active"
            value={isAdsLoading ? <Skeleton className="h-8 w-16" /> : activeAds.toString()}
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
          />
          <MetricCard
            title="Total Impressions"
            value={isAdsLoading ? <Skeleton className="h-8 w-16" /> : (totalImpressions || 0).toLocaleString()}
            icon={<Eye className="h-5 w-5" />}
            color="purple"
          />
          <MetricCard
            title="Avg CTR"
            value={isAdsLoading ? <Skeleton className="h-8 w-16" /> : `${(avgCTR || 0).toFixed(2)}%`}
            icon={<BarChart3 className="h-5 w-5" />}
            color="cyan"
          />
        </div>
      )}

      {/* Ads Management Tab */}
      {activeTab === "ads" && (
        <>
          {/* Filters */}
          <Card className="frosted-glass border bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search ads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="vast">VAST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <Select value={filterPlacement} onValueChange={setFilterPlacement}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Placements" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Placements</SelectItem>
                      <SelectItem value="pre-roll">Pre-roll</SelectItem>
                      <SelectItem value="mid-roll">Mid-roll</SelectItem>
                      <SelectItem value="banner">Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <DateRangePicker
                    startDate={dateRange.start.toISOString().split("T")[0]}
                    endDate={dateRange.end.toISOString().split("T")[0]}
                    onChange={(start, end) => {
                      setDateRange({
                        start: new Date(start),
                        end: new Date(end),
                      })
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ads Table */}
          <Card className="frosted-glass border bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border-cyan-500/30">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thumbnail</TableHead>
                      <TableHead>Ad Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Placements</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isAdsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={9}>
                            <Skeleton className="h-12 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : adsError ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <p className="text-red-500">Failed to load ads</p>
                        </TableCell>
                      </TableRow>
                    ) : currentItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <p className="text-muted-foreground">No ads found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentItems.map((ad: any) => (
                        <TableRow key={ad.id}>
                          <TableCell>
                            <div
                              className="w-16 h-10 bg-black/50 rounded border border-white/10 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors overflow-hidden group"
                              onClick={() => {
                                setAdToPreview(ad)
                                setIsPreviewOpen(true)
                              }}
                            >
                              {ad.adType === "vast" ? (
                                <Badge variant="secondary" className="text-xs">
                                  VAST
                                </Badge>
                              ) : ad.thumbnailUrl ? (
                                <img
                                  src={ad.thumbnailUrl}
                                  alt={ad.adName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                />
                              ) : ad.creativeUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img
                                  src={ad.creativeUrl}
                                  alt={ad.adName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                />
                              ) : ad.creativeUrl?.includes(".m3u8") ? (
                                <Video className="h-5 w-5 text-blue-400" />
                              ) : (
                                <div className="text-xs text-white/40">No preview</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{ad.adName}</TableCell>
                          <TableCell>
                            <Badge variant={ad.adType === "vast" ? "secondary" : "outline"}>
                              {ad.adType.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {ad.placementType?.map((placement: string) => (
                                <Badge key={placement} variant="outline" className="text-xs">
                                  {placement}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>{ad.priority}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(ad.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(ad.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAdToPreview(ad)
                                    setIsPreviewOpen(true)
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Preview
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditAd(ad)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                {ad.status === "active" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateAdStatusMutation.mutate({
                                        adId: ad.id,
                                        status: "inactive",
                                      })
                                    }
                                  >
                                    Deactivate
                                  </DropdownMenuItem>
                                )}
                                {ad.status !== "active" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateAdStatusMutation.mutate({
                                        adId: ad.id,
                                        status: "active",
                                      })
                                    }
                                  >
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteAd(ad.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filteredAds.length} total items)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <AdAnalyticsDashboard
          dateRange={dateRange}
          onDateRangeChange={(start, end) => setDateRange({ start, end })}
          ads={adsData}
        />
      )}

      {/* Ad Preview Modal */}
      <AdPreviewModal ad={adToPreview} open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </div>
  )
}