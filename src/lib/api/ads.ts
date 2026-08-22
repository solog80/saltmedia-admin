// Ad API — backed by the self-hosted Supabase cluster (replaces Firestore +
// BigQuery). All data access is proxied through server-side Next.js routes so
// the service-role key never reaches the browser.

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
  landingPageUrl?: string
  durationSeconds?: number
  vastTagUrl?: string
  vastWrapperLimit?: number
  thumbnailUrl?: string
  midRollTriggerType?: "percentage" | "timestamp"
  midRollTriggerValue?: number
  startDate: Date
  endDate: Date
  priority: number
  frequencyCap?: {
    perUser?: number
    perPeriod?: "24h" | "7d"
  }
  createdAt?: Date
  updatedAt?: Date
}

// PostgREST returns snake_case; the app expects the camelCase Ad model.
function toAd(raw: any): Ad {
  return {
    id: raw.id,
    adName: raw.adName ?? raw.ad_name,
    adType: raw.adType ?? raw.ad_type,
    status: raw.status,
    placementType: raw.placementType ?? raw.placement_type ?? [],
    targetingRules: raw.targetingRules ?? raw.targeting_rules,
    creativeUrl: raw.creativeUrl ?? raw.creative_url,
    creativeType: raw.creativeType ?? raw.creative_type,
    landingPageUrl: raw.landingPageUrl ?? raw.landing_page_url,
    durationSeconds: raw.durationSeconds ?? raw.duration_seconds,
    vastTagUrl: raw.vastTagUrl ?? raw.vast_tag_url,
    vastWrapperLimit: raw.vastWrapperLimit ?? raw.vast_wrapper_limit,
    thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnail_url,
    midRollTriggerType: raw.midRollTriggerType ?? raw.mid_roll_trigger_type,
    midRollTriggerValue: raw.midRollTriggerValue ?? raw.mid_roll_trigger_value,
    priority: raw.priority,
    frequencyCap: raw.frequencyCap ?? raw.frequency_cap,
    startDate: new Date(raw.startDate ?? raw.start_date),
    endDate: new Date(raw.endDate ?? raw.end_date),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.created_at ? new Date(raw.created_at) : undefined,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.updated_at ? new Date(raw.updated_at) : undefined,
  } as Ad
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const adsApi = {
  // Get all ads (service role — includes inactive/pending, like old Firestore reads)
  async getAllAds(): Promise<Ad[]> {
    try {
      const rows = await request<any[]>("/api/ads");
      return rows.map(toAd);
    } catch (error) {
      console.error("Failed to fetch ads:", error)
      throw error
    }
  },

  // Create a new ad via PostgREST
  async createAd(ad: Ad): Promise<string> {
    try {
      const result = await request<{ id: string }>("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ad),
      })
      return result.id
    } catch (error) {
      console.error("Failed to create ad:", error)
      throw error
    }
  },

  // Update an existing ad via PostgREST
  async updateAd(adId: string, updates: Partial<Ad>): Promise<void> {
    try {
      await request("/api/ads?id=" + encodeURIComponent(adId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch (error) {
      console.error("Failed to update ad:", error)
      throw error
    }
  },

  // Update ad status only
  async updateAdStatus(
    adId: string,
    status: "active" | "inactive" | "pending"
  ): Promise<void> {
    return this.updateAd(adId, { status })
  },

  // Delete an ad from PostgREST
  async deleteAd(adId: string): Promise<void> {
    try {
      await request("/api/ads?id=" + encodeURIComponent(adId), {
        method: "DELETE",
      })
    } catch (error) {
      console.error("Failed to delete ad:", error)
      throw error
    }
  },

  // Get ad analytics from the cluster Go service (TimescaleDB hypertable)
  async getAdAnalytics(startDate: Date, endDate: Date): Promise<any> {
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      return await request<any>(`/api/ads/analytics?${params.toString()}`)
    } catch (error) {
      console.error("Failed to fetch ad analytics:", error)
      return {
        totalImpressions: 0,
        totalClicks: 0,
        avgCTR: 0,
        avgCompletionRate: 0,
        impressionTrends: [],
        engagementFunnel: [],
        topAds: [],
      }
    }
  },

  // Refresh the server-side ad cache (Go service /api/v1/refreshAdCache).
  // No-op if the local route isn't wired; logs instead of throwing.
  async refreshAdCache(): Promise<void> {
    try {
      await request("/api/ads/cache-refresh", { method: "POST" })
    } catch (error) {
      console.error("Failed to refresh ad cache:", error)
    }
  },

  // Get a single ad by ID
  async getAdById(adId: string): Promise<Ad | null> {
    try {
      const rows = await request<any[]>(`/api/ads?id=${encodeURIComponent(adId)}`)
      if (!rows || rows.length === 0) return null
      return toAd(rows[0])
    } catch (error) {
      console.error("Failed to fetch ad by ID:", error)
      return null
    }
  },

  // Get active ads for mobile (used by admin previews/other modules)
  async getActiveAds(placement?: string): Promise<Ad[]> {
    try {
      const rows = await request<any[]>("/api/ads")
      let ads = rows
        .filter((ad) => ad.status === "active")
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .map(toAd)
      if (placement) {
        ads = ads.filter((ad) => ad.placementType.includes(placement))
      }
      return ads
    } catch (error) {
      console.error("Failed to fetch active ads:", error)
      return []
    }
  },
}
