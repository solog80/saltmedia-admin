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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = (body?.name || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Collection name is required" }, { status: 400 })
    }

    if (!BUNNY_LIBRARY_ID || !BUNNY_ACCESS_KEY) {
      return NextResponse.json(
        { error: "Bunny API credentials not configured" },
        { status: 500 }
      )
    }

    // Reuse an existing collection with the same name (case-insensitive)
    const listRes = await fetch(
      `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID}/collections?page=1&itemsPerPage=1000`,
      {
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    )
    if (listRes.ok) {
      const listData = await listRes.json()
      const existing = (listData.items || []).find(
        (c: any) => (c.name || "").trim().toLowerCase() === name.toLowerCase() && c.guid
      )
      if (existing) {
        return NextResponse.json({ guid: existing.guid, name: existing.name, reused: true })
      }
    }

    const createRes = await fetch(
      `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID}/collections`,
      {
        method: "POST",
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name }),
      }
    )

    if (!createRes.ok) {
      const errorText = await createRes.text()
      return NextResponse.json(
        { error: `Bunny API error: ${createRes.status} ${errorText}` },
        { status: createRes.status }
      )
    }

    const created = await createRes.json()
    return NextResponse.json({ guid: created.guid, name: created.name || name, reused: false })
  } catch (error) {
    console.error("Error creating Bunny collection:", error)
    return NextResponse.json(
      { error: "Failed to create collection", details: String(error) },
      { status: 500 }
    )
  }
}