"use client";

import { useEffect, useState } from "react";

type ResetMode = "request" | "confirm";

export function ResetPasswordForm() {
  const [mode, setMode] = useState<ResetMode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("info");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackUserId = params.get("userId") ?? "";
    const callbackSecret = params.get("secret") ?? "";

    if (!callbackUserId || !callbackSecret) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setUserId(callbackUserId);
      setSecret(callbackSecret);
      setMode("confirm");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setMessage("");
    setMessageKind("info");

    try {
      const response = await fetch(mode === "confirm" ? "/api/auth/reset/confirm" : "/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "confirm"
            ? { userId, secret, password }
            : { email }
        )
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setMessageKind("error");
        setMessage(data.error ?? "Password reset could not be completed. Please try again.");
        return;
      }

      setMessageKind("success");
      setMessage(
        data.message ??
          (mode === "confirm"
            ? "Your password has been updated. You can now log in."
            : "Check your inbox for a password reset link.")
      );

      if (mode === "confirm") {
        setPassword("");
      }
    } catch {
      setMessageKind("error");
      setMessage("Password reset could not be completed. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {mode === "request" ? (
        <label className="grid gap-2 text-sm font-semibold text-bone">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 rounded border border-line bg-ink/70 px-3 text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            required
          />
        </label>
      ) : (
        <label className="grid gap-2 text-sm font-semibold text-bone">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-12 rounded border border-line bg-ink/70 px-3 text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            minLength={8}
            required
          />
        </label>
      )}

      {message ? (
        <p
          className={
            messageKind === "error"
              ? "rounded border border-gold/40 bg-gold/10 p-3 text-sm text-bone"
              : "rounded border border-violet/50 bg-violet/15 p-3 text-sm text-bone shadow-violet"
          }
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-12 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
      >
        {isPending ? "Please wait..." : mode === "confirm" ? "Update password" : "Send reset link"}
      </button>
    </form>
  );
}
