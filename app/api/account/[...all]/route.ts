import { usesPostgres } from "@/lib/backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Expose only the authentication flows this application actually uses.
const allowed = new Set(["sign-up/email", "sign-in/email", "sign-out", "get-session", "request-password-reset", "reset-password", "verify-email", "send-verification-email"]);
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/account\//, "");
  if (!usesPostgres() || !(allowed.has(path) || /^reset-password\/[^/]+$/.test(path))) return new Response(null, { status: 404 });
  try {
    const { auth } = await import("@/lib/auth-config");
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { console.error("[auth] request failed"); return Response.json({ message: "Authentication is temporarily unavailable." }, { status: 503 }); }
}
export { handle as GET, handle as POST };
