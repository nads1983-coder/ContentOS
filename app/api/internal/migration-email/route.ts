import { getPool } from "@/lib/db/client";
import { authorize, dispatchOne, summary, verifyDeliveries } from "@/lib/migration-email";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  // Fixed campaign, no recipient/content inputs, no cookies, no browser authorization.
  if (process.env.VERCEL_ENV !== "production") return new Response(null, { status: 404 });
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 401, headers });
  try {
    const pool = getPool();
    if (!await authorize(pool, token)) return new Response(null, { status: 401, headers });
    const action = new URL(request.url).searchParams.get("action") || "status";
    const key = process.env.RESEND_API_KEY;
    if (!key) return Response.json({ error: "mail_not_configured" }, { status: 503, headers });
    if (action === "status") return Response.json(await summary(pool), { headers });
    if (action === "send") return Response.json({ ...await dispatchOne(pool, key), totals: await summary(pool) }, { headers });
    if (action === "verify") return Response.json(await verifyDeliveries(pool, key), { headers });
    return new Response(null, { status: 400, headers });
  } catch {
    console.error("[migration-mail] operation unavailable; inspect durable ledger before retrying");
    return Response.json({ error: "operation_unavailable" }, { status: 503, headers });
  }
}
