"use client";

import { useState } from "react";
import { clearPendingCheckout } from "@/components/billing-buttons";

export function LogoutButton({ className }: { className?: string }) {
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    if (isPending) {
      return;
    }

    setIsPending(true);
    clearPendingCheckout();

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/");
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isPending}
      className={className ?? "rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-bone transition hover:border-gold/60 disabled:text-muted"}
    >
      {isPending ? "Logging out..." : "Log out"}
    </button>
  );
}
