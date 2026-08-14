import { NextRequest, NextResponse } from "next/server"

const SFX_OBJECTS = "https://objects.solofx.net"
const SFX_SIGN_KEY = process.env.SFX_SIGN_KEY

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    if (!SFX_SIGN_KEY) {
      return NextResponse.json(
        { error: "SFX_SIGN_KEY not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(
      `${SFX_OBJECTS}/_sign?path=${encodeURIComponent(path)}`,
      {
        headers: { "X-Sign-Key": SFX_SIGN_KEY },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`SFX sign error: ${response.status}`, errorText)
      return NextResponse.json(
        { error: `SFX sign error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error signing SFX URL:", error)
    return NextResponse.json(
      { error: "Failed to sign SFX URL", details: String(error) },
      { status: 500 }
    )
  }
}
