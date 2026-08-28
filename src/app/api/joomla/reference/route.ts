import { NextRequest, NextResponse } from "next/server"
import { joomlaFetchCached } from "@/lib/joomla-cache"

const JOOMLA_API_URL = process.env.JOOMLA_API_URL || "https://saltmedia.ug/api/index.php/v1"
const JOOMLA_API_USERNAME = process.env.JOOMLA_API_USERNAME || ""
const JOOMLA_API_PASSWORD = process.env.JOOMLA_API_PASSWORD || ""
const REFERENCE_TTL_MS = 5 * 60_000

function authHeader(): string {
  const token = Buffer.from(`${JOOMLA_API_USERNAME}:${JOOMLA_API_PASSWORD}`).toString("base64")
  return `Basic ${token}`
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "categories"

    let url = ""
    if (type === "categories") {
      url = `${JOOMLA_API_URL}/content/categories?filter[extension]=com_content&page[limit]=200&sort=title`
    } else if (type === "authors") {
      url = `${JOOMLA_API_URL}/users?page[limit]=200&sort=name`
    } else if (type === "tags") {
      url = `${JOOMLA_API_URL}/tags?page[limit]=200&sort=title`
    } else {
      return NextResponse.json({ error: "Unknown reference type" }, { status: 400 })
    }

    const { status, body } = await joomlaFetchCached(url, {
      Authorization: authHeader(),
      Accept: "application/vnd.api+json",
    }, REFERENCE_TTL_MS)

    if (!(status >= 200 && status < 300)) {
      const msg = (body as any)?.errors?.[0]?.title || "Failed to fetch reference data"
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (e) {
    console.error("JOOMLA reference GET error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}