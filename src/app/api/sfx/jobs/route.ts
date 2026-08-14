import { NextRequest, NextResponse } from "next/server"

const SFX_API = "https://api.solofx.net"
const SFX_API_KEY = process.env.SFX_API_KEY

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name")
    const kind = request.nextUrl.searchParams.get("kind")

    let path: string
    if (kind === "duration" && name) {
      path = `/api/v1/duration?name=${encodeURIComponent(name)}`
    } else if (kind === "videos") {
      path = "/api/v1/videos"
    } else if (name) {
      path = `/api/v1/jobs/${encodeURIComponent(name)}`
    } else {
      path = "/api/v1/jobs"
    }

    if (!SFX_API_KEY) {
      return NextResponse.json(
        { error: "SFX_API_KEY not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(`${SFX_API}${path}`, {
      headers: { "X-API-Key": SFX_API_KEY },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`SFX API error: ${response.status}`, errorText)
      return NextResponse.json(
        { error: `SFX API error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching SFX jobs:", error)
    return NextResponse.json(
      { error: "Failed to fetch SFX jobs", details: String(error) },
      { status: 500 }
    )
  }
}
