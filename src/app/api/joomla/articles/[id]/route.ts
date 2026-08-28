import { NextRequest, NextResponse } from "next/server"
import { joomlaFetchCached, invalidateJoomlaCache } from "@/lib/joomla-cache"

const JOOMLA_API_URL = process.env.JOOMLA_API_URL || "https://saltmedia.ug/api/index.php/v1"
const JOOMLA_API_USERNAME = process.env.JOOMLA_API_USERNAME || ""
const JOOMLA_API_PASSWORD = process.env.JOOMLA_API_PASSWORD || ""
const ARTICLE_TTL_MS = 60_000

function authHeader(): string {
  const token = Buffer.from(`${JOOMLA_API_USERNAME}:${JOOMLA_API_PASSWORD}`).toString("base64")
  return `Basic ${token}`
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const url = `${JOOMLA_API_URL}/content/articles/${id}`
    const { status, body } = await joomlaFetchCached(url, {
      Authorization: authHeader(),
      Accept: "application/vnd.api+json",
    }, ARTICLE_TTL_MS)

    if (!(status >= 200 && status < 300)) {
      const msg = (body as any)?.errors?.[0]?.title || "Article not found"
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    })
  } catch (e) {
    console.error("JOOMLA article GET error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const patch = await request.json()

    const response = await fetch(`${JOOMLA_API_URL}/content/articles/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    })

    const body = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: body.errors?.[0]?.title || "Failed to update article" }, { status: response.status })
    }

    invalidateJoomlaCache(`${JOOMLA_API_URL}/content/articles`)
    return NextResponse.json(body)
  } catch (e) {
    console.error("JOOMLA article PATCH error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    // Joomla requires the article to be trashed (state=-2) before it can be deleted.
    const trashResponse = await fetch(`${JOOMLA_API_URL}/content/articles/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({ state: -2 }),
      cache: "no-store",
    })

    if (!trashResponse.ok) {
      const body = await trashResponse.json().catch(() => ({}))
      return NextResponse.json({ error: body.errors?.[0]?.title || "Failed to trash article" }, { status: trashResponse.status })
    }

    const deleteResponse = await fetch(`${JOOMLA_API_URL}/content/articles/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader(),
        Accept: "application/vnd.api+json",
      },
      cache: "no-store",
    })

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      const body = await deleteResponse.json().catch(() => ({}))
      return NextResponse.json({ error: body.errors?.[0]?.title || "Failed to delete article" }, { status: deleteResponse.status })
    }

    invalidateJoomlaCache(`${JOOMLA_API_URL}/content/articles`)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("JOOMLA article DELETE error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}