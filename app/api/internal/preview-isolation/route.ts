import { createHash, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { previewFixturesEnabled } from "@/lib/preview-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint has no effect outside the explicitly pinned PR22 QA Preview.
// It returns only a pass/fail result; it never returns identifiers or secrets.
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const secret = process.env.CONTENTOS_PREVIEW_DIAGNOSTIC_SECRET ?? "";
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "feat/paid-creator-lifetime-2026" ||
        process.env.CONTENTOS_ISOLATED_BRANCH !== "br-hidden-recipe-b9yqeimn")
      return Response.json({ verified: false, stage: "isolation_guard" }, { status: 503, headers });
    try {
      if (!previewFixturesEnabled()) return Response.json({ verified: false, stage: "isolation_guard" }, { status: 503, headers });
    } catch {
      return Response.json({ verified: false, stage: "isolation_guard" }, { status: 503, headers });
    }
    const expectedStripeHash = request.headers.get("x-preview-stripe-key-sha256");
    if (expectedStripeHash !== null) {
      const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
      if (!/^(sk|rk)_test_/.test(stripeKey) || !/^[a-f0-9]{64}$/.test(expectedStripeHash) ||
          !timingSafeEqual(Buffer.from(createHash("sha256").update(stripeKey).digest("hex")), Buffer.from(expectedStripeHash)))
        return Response.json({ verified: false, stage: "stripe_key_identity" }, { status: 503, headers });
    }
    const webhook = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    const expectedWebhookHash = request.headers.get("x-preview-webhook-sha256") ?? "";
    const validWebhook = !webhook || (webhook.startsWith("whsec_") && /^[a-f0-9]{64}$/.test(expectedWebhookHash) &&
      timingSafeEqual(Buffer.from(createHash("sha256").update(webhook).digest("hex")), Buffer.from(expectedWebhookHash)));
    if (!validWebhook || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      return Response.json({ verified: false, stage: "stripe_overrides" }, { status: 503, headers });
    const result = await getPool().query("SELECT current_database() = $1 AND current_user = $2 AS database_matches", ["pr22_payments_qa", "neondb_owner"]);
    if (result.rows.length !== 1 || result.rows[0].database_matches !== true)
      return Response.json({ verified: false, stage: "database_identity" }, { status: 503, headers });
    return Response.json(expectedStripeHash === null ? { verified: true } : { verified: true, stripeKeyMatches: true }, { headers });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const safeCode = ["28P01", "28000", "3D000", "ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "SELF_SIGNED_CERT_IN_CHAIN", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(String(code)) ? code : "other";
    return Response.json({ verified: false, stage: "database_unavailable", code: safeCode }, { status: 503, headers });
  }
}
