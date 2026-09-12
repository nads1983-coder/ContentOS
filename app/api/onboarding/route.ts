import { rejectUnsafeWrite } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveOnboarding } from "@/lib/repository";
import { OnboardingData } from "@/types/saas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const candidate = input as Record<string, unknown>;
  const fields = ["businessName", "audience", "niche", "goals", "writingTone"] as const;
  if (fields.some(key => typeof candidate[key] !== "string" || (candidate[key] as string).length > 2000)
    || !Array.isArray(candidate.preferredPlatforms) || candidate.preferredPlatforms.length > 20
    || candidate.preferredPlatforms.some(value => typeof value !== "string" || value.length > 80)) {
    return NextResponse.json({ error: "Invalid onboarding details." }, { status: 400 });
  }
  // Explicit fields only: client-supplied IDs, plans and privileges are ignored.
  const data = Object.fromEntries(fields.map(key => [key, candidate[key]])) as Omit<OnboardingData, "preferredPlatforms">;
  try { await saveOnboarding(user.id, { ...data, preferredPlatforms: candidate.preferredPlatforms as string[] }); }
  catch { console.error("[onboarding] save failed"); return NextResponse.json({ error: "Unable to save details." }, { status: 503 }); }

  return NextResponse.json({ ok: true });
}
