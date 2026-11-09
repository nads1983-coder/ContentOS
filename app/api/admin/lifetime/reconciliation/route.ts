import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { reconciliationStatus, retryReconciliation } from "@/lib/lifetime-reconciliation-admin";
import { readAdminJson } from "@/lib/admin-json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  const user=await getCurrentUser();if(!user || !isAdminEmail(user.email))return Response.json({error:"Forbidden"},{status:403});
  try{return Response.json(await reconciliationStatus(),{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"Reconciliation status unavailable."},{status:503});}
}
export async function POST(request:Request) {
  const rejected=rejectUnsafeWrite(request);if(rejected)return rejected;
  const user=await getCurrentUser();if(!user || !isAdminEmail(user.email))return Response.json({error:"Forbidden"},{status:403});
  try {
    const body=await readAdminJson(request) as {kind?:unknown;id?:unknown;reason?:unknown};
    if(typeof body?.kind!=="string" || typeof body?.id!=="string" || typeof body?.reason!=="string")return Response.json({error:"Invalid request."},{status:400});
    return Response.json(await retryReconciliation(body.kind,body.id,user,body.reason),{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Job cannot be retried."},{status:409});}
}
