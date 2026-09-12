import "server-only";
// Preserve existing UI endpoints while using Better Auth's HTTP handler, including its CSRF and atomic rate limiter.
export async function authBridge(request: Request, action: "login" | "signup" | "logout" | "reset" | "confirm") {
  try {
    const { auth } = await import("@/lib/auth-config");
    const input = action === "logout" ? {} : await request.json();
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const base = auth.options.baseURL as string;
    const callbackURL = `${base}/login`;
    const [path, body] = action === "login" ? ["sign-in/email", { email, password: input.password }]
      : action === "signup" ? ["sign-up/email", { email, password: input.password, name: typeof input.fullName === "string" && input.fullName.trim() ? input.fullName.trim().slice(0, 100) : "ContentOS member", callbackURL }]
      : action === "reset" ? ["request-password-reset", { email, redirectTo: `${base}/reset-password` }]
      : action === "confirm" ? ["reset-password", { token: input.token, newPassword: input.password }]
      : ["sign-out", {}];
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const response = await auth.handler(new Request(`${base}/api/account/${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
    const result = await response.json();
    const outgoing = new Headers(response.headers);
    outgoing.set("Cache-Control", "no-store");
    outgoing.delete("content-length");
    const errors: Record<string, string> = {
      INVALID_EMAIL_OR_PASSWORD: "Check your email and password. Existing members: use Reset password once to securely claim your account after our upgrade.",
      EMAIL_NOT_VERIFIED: "Check your inbox to verify your email before signing in.",
      PASSWORD_TOO_SHORT: "Use a password with at least 12 characters.",
      INVALID_TOKEN: "This reset link is invalid or expired. Request a new link.",
      TOO_MANY_REQUESTS: "Too many attempts. Please wait before trying again."
    };
    if (!response.ok) return Response.json({ error: errors[result.code] || (response.status === 429 ? errors.TOO_MANY_REQUESTS : "Unable to complete this request. Please try again or reset your password.") }, { status: response.status, headers: outgoing });
    return Response.json(action === "signup" ? { ok: true, message: "Check your inbox to verify your email, then log in. If you already have an account, log in or reset your password." }
      : action === "reset" ? { ok: true, message: "If an account exists for that address, you will receive a password reset link." }
      : action === "login" ? { ok: true, redirectUrl: "/dashboard" } : { ok: true }, { headers: outgoing });
  } catch { console.error("[auth] request failed"); return Response.json({ error: "Authentication is temporarily unavailable." }, { status: 503 }); }
}
