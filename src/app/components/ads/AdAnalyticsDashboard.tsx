"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { adsApi } from "@/lib/api/ads"

interface AdAnalyticsDashboardProps {
  dateRange: {
    start: Date
    end: Date
  }
  onDateRangeChange: (start: Date, end: Date) => void
  ads?: any[]
}

export function AdAnalyticsDashboard({ dateRange, ads = [] }: AdAnalyticsDashboardProps) {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["adAnalytics", dateRange],
    queryFn: async () => {
      return await adsApi.getAdAnalytics(dateRange.start, dateRange.end)
    },
  })

  // Create a map of ad IDs to ad names
  const adNameMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    ads.forEach(ad => {
      map[ad.id] = ad.adName
    })
    return map
  }, [ads])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const impressionChartData = analyticsData?.impressionTrends || []
  const engagementFunnelData = analyticsData?.engagementFunnel || []
  const topAdsData = analyticsData?.topAds || []

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="frosted-glass border bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analyticsData?.totalImpressions || 0).toLocaleString()}</div>
            <p className="text-xs text-white/50">
              {analyticsData?.impressionTrend > 0 ? "+" : ""}
              {analyticsData?.impressionTrend}% vs last period
            </p>
          </CardContent>
        </Card>

        <Card className="frosted-glass border bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analyticsData?.totalClicks || 0).toLocaleString()}</div>
            <p className="text-xs text-white/50">
              {analyticsData?.clickTrend > 0 ? "+" : ""}
              {analyticsData?.clickTrend}% vs last period
            </p>
          </CardContent>
        </Card>

        <Card className="frosted-glass border bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analyticsData?.avgCTR || 0).toFixed(2)}%</div>
            <p className="text-xs text-white/50">Average across all ads</p>
          </CardContent>
        </Card>

        <Card className="frosted-glass border bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border-cyan-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analyticsData?.avgCompletionRate || 0).toFixed(2)}%</div>
            <p className="text-xs text-white/50">Video ads completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Impression Trends</TabsTrigger>
          <TabsTrigger value="funnel">Engagement Funnel</TabsTrigger>
          <TabsTrigger value="topads">Top Performing Ads</TabsTrigger>
        </TabsList>

        {/* Impression Trends */}
        <TabsContent value="trends">
          <Card className="frosted-glass border bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30">
            <CardHeader>
              <CardTitle>Impressions Over Time</CardTitle>
              <CardDescription>Daily impressions trend</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={impressionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="impressions" stroke="#3b82f6" name="Impressions" />
                  <Line type="monotone" dataKey="clicks" stroke="#10b981" name="Clicks" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Funnel */}
        <TabsContent value="funnel">
          <Card className="frosted-glass border bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30">
            <CardHeader>
              <CardTitle>Engagement Funnel</CardTitle>
              <CardDescription>Video ad completion metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={engagementFunnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="stage" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="users" fill="#3b82f6" name="Users" />
                  <Bar dataKey="percentage" fill="#10b981" name="%" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Performing Ads */}
        <TabsContent value="topads">
          <Card className="frosted-glass border bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30">
            <CardHeader>
              <CardTitle>Top Performing Ads</CardTitle>
              <CardDescription>Ranked by impressions and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad Name</TableHead>
                      <TableHead>Impressions</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>Completions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topAdsData && topAdsData.length > 0 ? (
                      topAdsData.map((ad: any, index: number) => {
                        const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100) : 0
                        const completionRate = ad.impressions > 0 ? ((ad.completes / ad.impressions) * 100) : 0
                        const adName = adNameMap[ad.adId] || ad.adId
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{adName}</TableCell>
                            <TableCell>{ad.impressions?.toLocaleString() || "0"}</TableCell>
                            <TableCell>{ad.clicks?.toLocaleString() || "0"}</TableCell>
                            <TableCell>{ctr.toFixed(2)}%</TableCell>
                            <TableCell>{ad.completes?.toLocaleString() || "0"} ({completionRate.toFixed(1)}%)</TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <p className="text-muted-foreground">No data available</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
