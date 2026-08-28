import { NextRequest, NextResponse } from "next/server"
import { joomlaFetchCached, invalidateJoomlaCache } from "@/lib/joomla-cache"

const JOOMLA_API_URL = process.env.JOOMLA_API_URL || "https://saltmedia.ug/api/index.php/v1"
const JOOMLA_API_USERNAME = process.env.JOOMLA_API_USERNAME || ""
const JOOMLA_API_PASSWORD = process.env.JOOMLA_API_PASSWORD || ""
const ARTICLES_TTL_MS = 60_000

function authHeader(): string {
  const token = Buffer.from(`${JOOMLA_API_USERNAME}:${JOOMLA_API_PASSWORD}`).toString("base64")
  return `Basic ${token}`
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams

    const params = new URLSearchParams()
    const search = sp.get("search")
    const category = sp.get("category")
    const state = sp.get("state")
    const featured = sp.get("featured")
    const author = sp.get("author")
    const limit = sp.get("limit") || "20"
    const offset = sp.get("offset") || "0"

    params.set("page[limit]", limit)
    params.set("page[offset]", offset)

    if (search) params.set("filter[search]", search)
    if (category) params.set("filter[category]", category)
    if (state) params.set("filter[state]", state)
    if (featured) params.set("filter[featured]", featured)
    if (author) params.set("filter[author]", author)

    // Sort by newest first
    params.set("sort", "-created")

    const url = `${JOOMLA_API_URL}/content/articles?${params.toString()}`
    const { status, body } = await joomlaFetchCached(url, {
      Authorization: authHeader(),
      Accept: "application/vnd.api+json",
    }, ARTICLES_TTL_MS)

    if (!(status >= 200 && status < 300)) {
      const msg = (body as any)?.errors?.[0]?.title || "Failed to fetch articles"
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    })
  } catch (e) {
    console.error("JOOMLA articles GET error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const article = await request.json()

    const READMORE = '<hr id="system-readmore" />'
    let introtext = article.introtext || ""
    let fulltext = article.fulltext || ""

    if (article.articletext) {
      const idx = article.articletext.indexOf(READMORE)
      if (idx >= 0) {
        introtext = article.articletext.slice(0, idx)
        fulltext = article.articletext.slice(idx + READMORE.length)
      } else {
        introtext = article.articletext
        fulltext = ""
      }
    }

    const payload = {
      title: article.title,
      alias: article.alias || "",
      catid: article.catid,
      introtext,
      fulltext,
      state: article.state ?? 1,
      access: article.access ?? 1,
      featured: article.featured ? 1 : 0,
      language: article.language || "*",
      created_by: article.created_by ?? undefined,
      created_by_alias: article.created_by_alias || "",
      images: article.images || {},
      publish_up: article.publish_up || undefined,
      publish_down: article.publish_down || undefined,
      metadesc: article.metadesc || "",
      metakey: article.metakey || "",
      tags: article.tags || [],
    }

    // Remove undefined keys so Joomla uses defaults
    Object.keys(payload).forEach((k) => {
      if (payload[k as keyof typeof payload] === undefined) delete payload[k as keyof typeof payload]
    })

    const response = await fetch(`${JOOMLA_API_URL}/content/articles`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const body = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: body.errors?.[0]?.title || "Failed to create article" }, { status: response.status })
    }

    invalidateJoomlaCache(`${JOOMLA_API_URL}/content/articles`)
    return NextResponse.json(body, { status: 201 })
  } catch (e) {
    console.error("JOOMLA articles POST error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}