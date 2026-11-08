import { timingSafeEqual } from "node:crypto";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";
import { reconcileLifetimeCheckouts } from "@/lib/paid-lifetime-reconciliation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual,expected)) return Response.json({error:"Unauthorized"},{status:401});
  if (!PAID_LIFETIME_OFFER.fulfillmentEnabled) return Response.json({skipped:"Lifetime processing disabled"});
  return Response.json(await reconcileLifetimeCheckouts());
}
