import { getCurrentUser } from "@/lib/auth";
import { topupAccountSummary } from "@/lib/ai-topup-payments";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  const user=await getCurrentUser();if(!user)return Response.json({error:"Please sign in."},{status:401});
  try{return Response.json(await topupAccountSummary(user.id),{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"Purchased-credit information is temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
