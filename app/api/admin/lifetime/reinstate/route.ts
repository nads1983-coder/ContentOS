import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";
import { approveLifetimeReinstatement } from "@/lib/paid-lifetime-fulfillment";
import { readAdminJson } from "@/lib/admin-json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const rejected=rejectUnsafeWrite(request); if(rejected)return rejected;
  const user=await getCurrentUser();
  if(!user || !isAdminEmail(user.email))return Response.json({error:"Forbidden"},{status:403});
  if(!PAID_LIFETIME_OFFER.fulfillmentEnabled)return Response.json({error:"Lifetime processing is disabled."},{status:503});
  try {
    const body=await readAdminJson(request) as {purchaseId?:unknown;reason?:unknown};
    if(typeof body?.purchaseId!=="string" || typeof body?.reason!=="string")return Response.json({error:"Invalid request."},{status:400});
    return Response.json(await approveLifetimeReinstatement(body.purchaseId,user,body.reason),{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"Reinstatement requires payment reconciliation."},{status:409,headers:{"Cache-Control":"no-store"}}); }
}
