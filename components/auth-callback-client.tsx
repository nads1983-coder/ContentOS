"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import {
  clearPendingCheckout,
  getPendingCheckout,
  getPendingFounderOffer
} from "@/components/billing-buttons";

type CallbackState = "checking" | "confirmed-login-required" | "redirecting" | "error";

export function AuthCallbackClient() {
  const [state, setState] = useState<CallbackState>("checking");
  const [message, setMessage] = useState("Confirming your ContentOS account...");
  const query = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }

    return new URLSearchParams(window.location.search);
  }, []);

  useEffect(() => {
    async function completeCallback() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token") ?? undefined;
      const expiresInRaw = hash.get("expires_in");
      const errorDescription =
        query.get("error_description") ??
        hash.get("error_description") ??
        query.get("error") ??
        hash.get("error");

      if (errorDescription) {
        setState("error");
        setMessage(errorDescription);
        return;
      }

      if (!accessToken) {
        setState("confirmed-login-required");
        setMessage("Email confirmed. Please log in to continue.");
        return;
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          expiresIn: expiresInRaw ? Number(expiresInRaw) : undefined
        })
      });

      if (!response.ok) {
        setState("confirmed-login-required");
        setMessage("Email confirmed. Please log in to continue.");
        return;
      }

      const pendingPlan = getPendingCheckout();
      const pendingFounderOffer = getPendingFounderOffer();

      if (pendingPlan) {
        if (pendingFounderOffer) {
          setState("redirecting");
          setMessage("Account confirmed. Opening your free Founder checkout summary...");
          window.location.replace("/founder/checkout");
          return;
        }

        const checkoutResponse = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: pendingPlan, founderOffer: pendingFounderOffer })
        });
        const checkoutData = (await checkoutResponse.json()) as {
          url?: string;
          redirectUrl?: string;
          error?: string;
        };

        clearPendingCheckout();

        if (checkoutResponse.ok && checkoutData.url) {
          setState("redirecting");
          setMessage("Account confirmed. Opening checkout...");
          window.location.replace(checkoutData.url);
          return;
        }

        window.location.replace(checkoutData.redirectUrl ?? "/dashboard");
        return;
      }

      clearPendingCheckout();
      setState("redirecting");
      setMessage("Account confirmed. Opening your workspace...");
      window.location.replace("/studio");
    }

    completeCallback().catch(() => {
      setState("confirmed-login-required");
      setMessage("Email confirmed. Please log in to continue.");
    });
  }, [query]);

  return (
    <>
      <BrandLogo />
      <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">
        {state === "checking" || state === "redirecting" ? "Confirming account" : "Email confirmed"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
      {state === "confirmed-login-required" || state === "error" ? (
        <div className="mt-6 grid gap-3">
          <Link
            href="/login?confirmed=1"
            className="flex min-h-11 items-center justify-center rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet"
          >
            Log in to continue
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone"
          >
            Back to ContentOS
          </Link>
        </div>
      ) : null}
    </>
  );
}
