import { authBridge } from "@/lib/auth-bridge";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) { return authBridge(request, "confirm"); }
