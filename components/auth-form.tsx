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
  const [isPending, setIsPending] = useState(false);
  const endpoint = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : "/api/auth/reset";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage("");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = (await response.json()) as { error?: string };

    setIsPending(false);

    if (!response.ok) {
      setMessage(data.error ?? "Something went wrong.");
      return;
    }

    if (mode === "reset") {
      setMessage("Check your inbox for a password reset link.");
      return;
    }

    window.location.href = "/dashboard";
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
        <p className="rounded border border-gold/40 bg-gold/10 p-3 text-sm text-bone">
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
          <Link href="/signup" className="hover:text-bone">
            Create account
          </Link>
        </div>
      ) : null}
    </form>
  );
}
