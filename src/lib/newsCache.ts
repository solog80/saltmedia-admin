const BFF_URL = (process.env.RADIO_BFF_URL || "https://edge.solofx.net").replace(/\/$/, "");

function accessHeaders(): Record<string, string> {
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  return id && secret
    ? {
        "CF-Access-Client-Id": id,
        "CF-Access-Client-Secret": secret,
      }
    : {};
}

async function purgeBffPath(path: string, label: string): Promise<void> {
  try {
    const res = await fetch(`${BFF_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...accessHeaders(),
      },
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

export function purgeOnDemandCache(): Promise<void> {
  return purgeBffPath(
    "/api/v1/bff/ondemand/purge-cache-admin",
    "ondemand-cache"
  );
}
