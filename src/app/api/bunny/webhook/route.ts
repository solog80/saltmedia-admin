import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://edge.solofx.net/api/v1";

/**
 * Webhook receiver for Bunny Stream video events.
 * Forwards directly to Edge Go cluster (salt-gofn) which updates Supabase
 * and invalidates the on-demand catalog cache.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const sig = request.headers.get("x-bunnystream-signature");
    if (sig) headers["x-bunnystream-signature"] = sig;

    const sigAlg = request.headers.get("x-bunnystream-signature-algorithm");
    if (sigAlg) headers["x-bunnystream-signature-algorithm"] = sigAlg;

    const sigVer = request.headers.get("x-bunnystream-signature-version");
    if (sigVer) headers["x-bunnystream-signature-version"] = sigVer;

    const edgeRes = await fetch(`${API_BASE}/bunnyWebhook`, {
      method: "POST",
      headers,
      body: rawBody,
      cache: "no-store",
    });

    const edgeData = await edgeRes.json().catch(() => ({}));
    return NextResponse.json(edgeData, { status: edgeRes.status });
  } catch (err: any) {
    console.error("[api/bunny/webhook] Error handling webhook:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
