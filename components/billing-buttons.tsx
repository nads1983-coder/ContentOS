"use client";

import { useState } from "react";
import { clsx } from "clsx";

export function CheckoutButton({
  plan,
  children,
  className,
  authenticated,
  covered,
  founderOffer = false
}: {
  plan: "pro_creator" | "pro_studio";
  children: React.ReactNode;
  className?: string;
  authenticated?: boolean;
  covered?: boolean;
  founderOffer?: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    if (covered) {
      clearPendingCheckout();
      window.location.href = "/dashboard";
      return;
    }

    if (authenticated === false) {
      setPendingCheckout(plan, founderOffer);
      window.location.href = `/signup?plan=${plan}${founderOffer ? "&founder=1" : ""}`;
      return;
    }

    setIsPending(true);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, founderOffer })
      });
      const data = (await response.json()) as {
        url?: string;
        error?: string;
        redirectUrl?: string;
      };

      if (response.status === 401 && data.redirectUrl) {
        setPendingCheckout(plan);
        window.location.href = data.redirectUrl;
        return;
      }

      if (response.status === 409 && data.redirectUrl) {
        clearPendingCheckout();
        window.location.href = data.redirectUrl;
        return;
      }

      if (!response.ok || !data.url) {
        setError(data.error ?? "Checkout is not available.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Checkout could not be opened. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={checkout}
        disabled={isPending}
        className={clsx(
          "min-h-11 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted",
          className
        )}
      >
        {isPending ? "Opening checkout..." : children}
      </button>
      {error ? <p className="text-xs text-goldSoft">{error}</p> : null}
    </div>
  );
}

function setPendingCheckout(plan: "pro_creator" | "pro_studio", founderOffer = false) {
  try {
    window.localStorage.setItem("contentos_pending_checkout_plan", plan);
    window.localStorage.setItem("contentos_pending_checkout_at", new Date().toISOString());
    if (founderOffer) {
      window.localStorage.setItem("contentos_pending_founder_offer", "1");
    } else {
      window.localStorage.removeItem("contentos_pending_founder_offer");
    }
  } catch {
    // Some browsers block localStorage; query params still preserve the plan.
  }
}

export function getPendingCheckout(): "pro_creator" | "pro_studio" | null {
  try {
    const value = window.localStorage.getItem("contentos_pending_checkout_plan");
    return value === "pro_creator" || value === "pro_studio" ? value : null;
  } catch {
    return null;
  }
}

export function getPendingFounderOffer() {
  try {
    return window.localStorage.getItem("contentos_pending_founder_offer") === "1";
  } catch {
    return false;
  }
}

export function clearPendingCheckout() {
  try {
    window.localStorage.removeItem("contentos_pending_checkout_plan");
    window.localStorage.removeItem("contentos_pending_checkout_at");
    window.localStorage.removeItem("contentos_pending_founder_offer");
  } catch {
    // Ignore storage cleanup failures.
  }
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
