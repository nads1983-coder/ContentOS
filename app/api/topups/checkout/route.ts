import { getCurrentUser } from "@/lib/auth";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { readAdminJson } from "@/lib/admin-json";
import { AI_TOPUP_OFFER } from "@/lib/ai-topup-offer";
import { prepareTopup } from "@/lib/ai-topup-payments";
import { getUserProfileForUser } from "@/lib/repository";
import { effectiveGenerationPlan } from "@/lib/generation-reservation";
import { createTestTopupCheckoutSession } from "@/lib/stripe-rest";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const rejected=rejectUnsafeWrite(request);if(rejected)return rejected;
  if(!AI_TOPUP_OFFER.checkoutEnabled)return Response.json({error:"Prepaid top-ups are not available."},{status:503});
  const user=await getCurrentUser();if(!user)return Response.json({error:"Please sign in."},{status:401});
  if(request.headers.get("X-ContentOS-Account")!==user.id)return Response.json({error:"Your account session changed."},{status:409});
  try {
    const body=await readAdminJson(request) as {package?:unknown;requestId?:unknown};
    if(typeof body?.package!=="string" || typeof body?.requestId!=="string")return Response.json({error:"Invalid request."},{status:400});
    const profile=await getUserProfileForUser(user.id,user.email);
    if(!profile || effectiveGenerationPlan(profile)==="free")return Response.json({error:"An active paid membership is required."},{status:403});
    const purchase=await prepareTopup(user.id,body.package,body.requestId);
    if(!["preparing","open"].includes(purchase.status))return Response.json({error:"This purchase attempt is already closed."},{status:409});
    const session=await createTestTopupCheckoutSession({id:purchase.id,accountId:user.id,attemptKey:purchase.attempt_key,pricePence:purchase.price_pence,credits:purchase.credits,email:user.email});
    return Response.json(session,{headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({error:"Checkout could not be confirmed. Check purchase history before trying again."},{status:503});}
}
