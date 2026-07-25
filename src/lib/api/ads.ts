import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase"

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

export const adsApi = {
  // Get all ads from Firestore
  async getAllAds(): Promise<Ad[]> {
    try {
      const adsCollection = collection(db, "ads")
      const q = query(adsCollection, orderBy("priority", "desc"))
      const snapshot = await getDocs(q)

      return snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate?.() || new Date(data.startDate),
          endDate: data.endDate?.toDate?.() || new Date(data.endDate),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        } as Ad
      })
    } catch (error) {
      console.error("Failed to fetch ads:", error)
      throw error
    }
  },

  // Create a new ad in Firestore
  async createAd(ad: Ad): Promise<string> {
    try {
      const adsCollection = collection(db, "ads")
      const docRef = await addDoc(adsCollection, {
        ...ad,
        startDate: Timestamp.fromDate(ad.startDate),
        endDate: Timestamp.fromDate(ad.endDate),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      // TODO: Cache in Upstash after creation
      // await upstashClient.set(`ads:${docRef.id}`, JSON.stringify(ad))

      return docRef.id
    } catch (error) {
      console.error("Failed to create ad:", error)
      throw error
    }
  },

  // Update an existing ad in Firestore
  async updateAd(adId: string, updates: Partial<Ad>): Promise<void> {
    try {
      const adRef = doc(db, "ads", adId)

      const dataToUpdate: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      }

      if (updates.startDate) {
        dataToUpdate.startDate = Timestamp.fromDate(updates.startDate)
      }
      if (updates.endDate) {
        dataToUpdate.endDate = Timestamp.fromDate(updates.endDate)
      }

      await updateDoc(adRef, dataToUpdate)

      // TODO: Update cache in Upstash
      // await upstashClient.set(`ads:${adId}`, JSON.stringify({ ...updates }))
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

  // Delete an ad from Firestore
  async deleteAd(adId: string): Promise<void> {
    try {
      const adRef = doc(db, "ads", adId)
      await deleteDoc(adRef)

      // TODO: Delete from Upstash cache
      // await upstashClient.del(`ads:${adId}`)
    } catch (error) {
      console.error("Failed to delete ad:", error)
      throw error
    }
  },

  // Get ad analytics from Cloud Functions or BigQuery
  async getAdAnalytics(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Call Cloud Function to get analytics
      const getAdAnalyticsFunction = httpsCallable(functions, "getAdAnalytics")
      const response = await getAdAnalyticsFunction({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      return response.data
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

  // Refresh cache in Upstash (no RTDB)
  async refreshAdCache(): Promise<void> {
    try {
      // TODO: Implement Upstash cache refresh
      // const allAds = await this.getAllAds()
      // for (const ad of allAds) {
      //   if (ad.status === 'active') {
      //     await upstashClient.set(
      //       `ads:${ad.id}`,
      //       JSON.stringify(ad),
      //       { ex: 3600 } // 1 hour TTL
      //     )
      //   }
      // }
      console.log("Ad cache refresh (Upstash) would be triggered here")
    } catch (error) {
      console.error("Failed to refresh ad cache:", error)
    }
  },

  // Get ad by ID from Firestore
  async getAdById(adId: string): Promise<Ad | null> {
    try {
      const adsCollection = collection(db, "ads")
      const q = query(adsCollection, where("__name__", "==", adId))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        return null
      }

      const data = snapshot.docs[0].data()
      return {
        id: snapshot.docs[0].id,
        ...data,
        startDate: data.startDate?.toDate?.() || new Date(data.startDate),
        endDate: data.endDate?.toDate?.() || new Date(data.endDate),
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      } as Ad
    } catch (error) {
      console.error("Failed to fetch ad by ID:", error)
      return null
    }
  },

  // Get active ads for mobile (check Upstash cache first, then Firestore)
  async getActiveAds(placement?: string): Promise<Ad[]> {
    try {
      // TODO: Check Upstash cache first
      // const cached = await upstashClient.get(`ads:active:${placement || 'all'}`)
      // if (cached) return JSON.parse(cached)

      // Fallback to Firestore
      const adsCollection = collection(db, "ads")
      let q = query(
        adsCollection,
        where("status", "==", "active"),
        orderBy("priority", "desc")
      )

      const snapshot = await getDocs(q)

      let ads = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate?.() || new Date(data.startDate),
          endDate: data.endDate?.toDate?.() || new Date(data.endDate),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        } as Ad
      })

      // Filter by placement if provided
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