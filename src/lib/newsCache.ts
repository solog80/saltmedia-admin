const BFF_URL = (process.env.RADIO_BFF_URL || "https://edge.solofx.net").replace(/\/$/, "");

export async function purgeNewsCache(): Promise<void> {
  try {
    const res = await fetch(`${BFF_URL}/api/v1/bff/news/purge-cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[news-cache] BFF purge returned ${res.status}`);
    }
  } catch (error) {
    console.warn("[news-cache] BFF purge failed", error);
  }
}
