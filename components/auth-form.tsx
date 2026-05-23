"use client";

import { useState } from "react";
import Link from "next/link";

type AuthFormProps = {
  mode: "login" | "signup" | "reset";
};

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("info");
  const [isPending, setIsPending] = useState(false);
  const endpoint = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : "/api/auth/reset";
  const plan =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("plan")
      : null;
  const checkoutPlan = plan === "pro_creator" || plan === "pro_studio" ? plan : null;
  const planQuery = checkoutPlan ? `?plan=${checkoutPlan}` : "";

  async function continueToCheckout() {
    if (!checkoutPlan) {
      window.location.href = "/dashboard";
      return;
    }

    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: checkoutPlan })
    });
    const data = (await response.json()) as {
      url?: string;
      error?: string;
      redirectUrl?: string;
    };

    if (response.ok && data.url) {
      window.location.href = data.url;
      return;
    }

    if (response.status === 401 && data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }

    if (response.status === 409 && data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }

    setMessageKind("error");
    setMessage(data.error ?? "Your account is ready, but checkout could not be opened.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }

    setIsPending(true);
    setMessage("");
    setMessageKind("info");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        redirectUrl?: string;
        status?: string;
      };

      if (!response.ok) {
        setMessageKind("error");
        setMessage(
          data.error ??
            (mode === "signup"
              ? "Unable to create account. Please try again."
              : "Something went wrong.")
        );
        return;
      }

      if (mode === "reset") {
        setMessageKind("success");
        setMessage("Check your inbox for a password reset link.");
        return;
      }

      if (data.message && !data.redirectUrl) {
        setMessageKind("success");
        setMessage(data.message);
        return;
      }

      await continueToCheckout();
    } catch {
      setMessageKind("error");
      setMessage(
        mode === "signup"
          ? "Unable to create account. Please try again."
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
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
      {mode !== "reset" ? (
        <label className="grid gap-2 text-sm font-semibold text-bone">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-12 rounded border border-line bg-ink/70 px-3 text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            minLength={8}
            required
          />
        </label>
      ) : null}
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
        {isPending
          ? "Please wait..."
          : mode === "login"
            ? "Log in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
      </button>
      {mode === "login" ? (
        <div className="flex justify-between text-sm text-muted">
          <Link href="/reset-password" className="hover:text-bone">
            Reset password
          </Link>
          <Link href={`/signup${planQuery}`} className="hover:text-bone">
            Create account
          </Link>
        </div>
      ) : null}
      {mode === "signup" ? (
        <Link href={`/login${planQuery}`} className="text-sm text-muted hover:text-bone">
          Already have an account? Log in
        </Link>
      ) : null}
    </form>
  );
}
