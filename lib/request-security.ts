import "server-only";
import { usesPostgres } from "@/lib/backend";

// Cookie-authenticated browser writes must come from the application itself.
export function rejectUnsafeWrite(request: Request): Response | null {
  if (!usesPostgres()) return null;
  const expected = process.env.BETTER_AUTH_URL || (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://getcontentos.co");
  if (request.headers.get("origin") !== new URL(expected).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}
