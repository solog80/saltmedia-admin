// Server-only in-memory TTL cache for Joomla GETs.
// Joomla responses (~0.7-1.6s) are expensive and the news pages fire many of
// them per visit; caching for a short TTL makes repeat loads instant. Writes
// (POST/PATCH/DELETE) invalidate the affected keys so edits show up promptly.

interface CacheEntry {
  expiresAt: number
  status: number
  body: unknown
}

const store = new Map<string, CacheEntry>()

export async function joomlaFetchCached(
  url: string,
  headers: Record<string, string>,
  cacheMs: number
): Promise<{ status: number; body: unknown }> {
  const now = Date.now()
  const hit = store.get(url)
  if (hit && hit.expiresAt > now) {
    return { status: hit.status, body: hit.body }
  }

  const res = await fetch(url, { headers, cache: "no-store" })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (res.ok) {
    store.set(url, { expiresAt: now + cacheMs, status: res.status, body })
  }

  return { status: res.status, body }
}

export function invalidateJoomlaCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}