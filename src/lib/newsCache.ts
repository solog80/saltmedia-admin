const BFF_URL = (process.env.RADIO_BFF_URL || "https://edge.solofx.net").replace(/\/$/, "");

async function purgeBffPath(path: string, label: string): Promise<void> {
  try {
    const res = await fetch(`${BFF_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[${label}] BFF purge returned ${res.status}`);
    }
  } catch (error) {
    console.warn(`[${label}] BFF purge failed`, error);
  }
}

export function purgeNewsCache(): Promise<void> {
  return purgeBffPath("/api/v1/bff/news/purge-cache", "news-cache");
}

export function purgeEpgCache(): Promise<void> {
  return purgeBffPath("/api/v1/bff/epg/purge-cache", "epg-cache");
}
