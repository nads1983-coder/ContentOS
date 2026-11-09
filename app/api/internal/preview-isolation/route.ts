import { timingSafeEqual } from "node:crypto";
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
        process.env.CONTENTOS_ISOLATED_BRANCH !== "br-hidden-recipe-b9yqeimn" || !previewFixturesEnabled() ||
        process.env.STRIPE_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      return Response.json({ verified: false }, { status: 503, headers });
    const result = await getPool().query("SELECT current_database() = $1 AND current_user = $2 AS database_matches", ["pr22_payments_qa", "neondb_owner"]);
    if (result.rows.length !== 1 || result.rows[0].database_matches !== true)
      return Response.json({ verified: false }, { status: 503, headers });
    return Response.json({ verified: true }, { headers });
  } catch {
    return Response.json({ verified: false }, { status: 503, headers });
  }
}
