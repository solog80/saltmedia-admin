import { NextRequest, NextResponse } from "next/server"

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "307069"
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || "a2c0dc75-a237-41e2-b8a5d6edaff5-2c59-4c18"
const BUNNY_PULL_ZONE_DOMAIN = process.env.BUNNY_PULL_ZONE_DOMAIN || "vz-13b87e04-41b.b-cdn.net"
const BUNNY_BASE_URL = "https://video.bunnycdn.com"

export async function GET(request: NextRequest) {
  try {
    const collectionId = request.nextUrl.searchParams.get("collectionId")

    if (!collectionId) {
      return NextResponse.json(
        { error: "collectionId is required" },
        { status: 400 }
      )
    }

    if (!BUNNY_LIBRARY_ID || !BUNNY_ACCESS_KEY) {
      return NextResponse.json(
        { error: "Bunny API credentials not configured" },
        { status: 500 }
      )
    }

    // Fetch all videos and filter by collectionId on the client side
    const response = await fetch(
      `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID}/videos?pageSize=100`,
      {
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Bunny API error: ${response.status}`, errorText)
      return NextResponse.json(
        { error: `Bunny API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Filter videos by collection ID
    const filteredVideos = (data.items || []).filter(
      (video: any) => video.collectionId && video.collectionId.toString() === collectionId
    )

    return NextResponse.json({
      videos: filteredVideos,
      pullZoneDomain: BUNNY_PULL_ZONE_DOMAIN,
    })
  } catch (error) {
    console.error("Error fetching Bunny videos:", error)
    return NextResponse.json(
      { error: "Failed to fetch videos", details: String(error) },
      { status: 500 }
    )
  }
}