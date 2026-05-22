"use client";

import { useState } from "react";

export function CheckoutButton({
  plan,
  children
}: {
  plan: "pro_creator" | "pro_studio";
  children: React.ReactNode;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setIsPending(true);
    setError("");

    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan })
    });
    const data = (await response.json()) as { url?: string; error?: string };

    setIsPending(false);

    if (!response.ok || !data.url) {
      setError(data.error ?? "Checkout is not available.");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={checkout}
        disabled={isPending}
        className="min-h-11 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
      >
        {isPending ? "Opening checkout..." : children}
      </button>
      {error ? <p className="text-xs text-goldSoft">{error}</p> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setIsPending(true);
    setError("");
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = (await response.json()) as { url?: string; error?: string };
    setIsPending(false);

    if (!response.ok || !data.url) {
      setError(data.error ?? "Billing portal is not available.");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={openPortal}
        disabled={isPending}
        className="min-h-11 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-gold/60 disabled:text-muted"
      >
        {isPending ? "Opening billing..." : "Manage subscription"}
      </button>
      {error ? <p className="text-xs text-goldSoft">{error}</p> : null}
    </div>
  );
}
