import { timingSafeEqual } from "node:crypto";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";
import { reconcileLifetimeCheckouts } from "@/lib/paid-lifetime-reconciliation";
import { AI_TOPUP_OFFER } from "@/lib/ai-topup-offer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual,expected)) return Response.json({error:"Unauthorized"},{status:401});
  if (!PAID_LIFETIME_OFFER.fulfillmentEnabled && !AI_TOPUP_OFFER.fulfillmentEnabled) return Response.json({skipped:"Lifetime processing disabled"});
  const lifetime=PAID_LIFETIME_OFFER.fulfillmentEnabled ? await reconcileLifetimeCheckouts() : null;
  const topups=AI_TOPUP_OFFER.fulfillmentEnabled ? await (await import("@/lib/ai-topup-reconciliation")).reconcileTopups() : null;
  if(lifetime && !topups && process.env.CONTENTOS_RECONCILIATION_ALERT_URL) await (await import("@/lib/ai-topup-reconciliation")).deliverTopupAlerts();
  if(!topups && lifetime)return Response.json(lifetime);
  return Response.json({lifetime,topups});
}
