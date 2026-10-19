import { usesPostgres } from "@/lib/backend";
import { isPreviewAccount, previewFixturesEnabled } from "@/lib/preview-fixtures";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Expose only the authentication flows this application actually uses.
const allowed = new Set(["sign-up/email", "sign-in/email", "sign-out", "get-session", "request-password-reset", "reset-password", "verify-email", "send-verification-email"]);
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/account\//, "");
  if (!usesPostgres() || !(allowed.has(path) || /^reset-password\/[^/]+$/.test(path))) return new Response(null, { status: 404 });
  try {
    if (previewFixturesEnabled()) {
      if (!["sign-in/email", "get-session", "sign-out"].includes(path)) return Response.json({ message: "This protected Preview uses pre-verified synthetic accounts. Registration and email delivery are disabled." }, { status: 403 });
      if (path === "sign-in/email") {
        const body = await request.clone().json();
        if (typeof body.email !== "string" || !isPreviewAccount(body.email.toLowerCase())) return Response.json({ message: "Use a synthetic Preview account." }, { status: 403 });
      }
    }
    const { auth } = await import("@/lib/auth-config");
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { console.error("[auth] request failed"); return Response.json({ message: "Authentication is temporarily unavailable." }, { status: 503 }); }
}
export { handle as GET, handle as POST };
