import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { readAdminJson } from "@/lib/admin-json";
import { reviewTopup } from "@/lib/ai-topup-review";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const rejected=rejectUnsafeWrite(request);if(rejected)return rejected;
  const administrator=await getCurrentUser();
  if(!administrator || !isAdminEmail(administrator.email))return Response.json({error:"Forbidden"},{status:403});
  try {
    const body=await readAdminJson(request) as {purchaseId?:unknown;reason?:unknown;decision?:unknown};
    if(typeof body?.purchaseId!=="string" || typeof body.reason!=="string" || !["reinstate","retain_freeze"].includes(String(body.decision)))throw new Error("Invalid review.");
    const result=await reviewTopup(body.purchaseId,administrator,body.reason,body.decision as "reinstate"|"retain_freeze");
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Purchase cannot be approved; verify current payment evidence and unresolved disputes."},{status:409});}
}
