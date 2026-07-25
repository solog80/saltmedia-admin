import { NextRequest, NextResponse } from "next/server"

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "307069"
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || "a2c0dc75-a237-41e2-b8a5d6edaff5-2c59-4c18"
const BUNNY_PULL_ZONE_DOMAIN = process.env.BUNNY_PULL_ZONE_DOMAIN || "vz-13b87e04-41b.b-cdn.net"
const BUNNY_BASE_URL = "https://video.bunnycdn.com"

export async function GET(request: NextRequest) {
  try {
    if (!BUNNY_LIBRARY_ID || !BUNNY_ACCESS_KEY) {
      return NextResponse.json(
        { error: "Bunny API credentials not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(
      `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID}/collections`,
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

    return NextResponse.json({
      collections: data.items || [],
      pullZoneDomain: BUNNY_PULL_ZONE_DOMAIN,
    })
  } catch (error) {
    console.error("Error fetching Bunny collections:", error)
    return NextResponse.json(
      { error: "Failed to fetch collections", details: String(error) },
      { status: 500 }
    )
  }
}