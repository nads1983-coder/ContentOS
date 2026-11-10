import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { currentFinancialReport } from "@/lib/ai-financial-report";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return Response.json({error:"Forbidden"},{status:403});
  try {
    return Response.json(await currentFinancialReport(),{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({error:"Financial report temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
