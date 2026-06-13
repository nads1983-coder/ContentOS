import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveOnboarding } from "@/lib/appwrite-rest";
import { OnboardingData } from "@/types/saas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const data = (await request.json()) as OnboardingData;
  await saveOnboarding(user.id, data);

  return NextResponse.json({ ok: true });
}
