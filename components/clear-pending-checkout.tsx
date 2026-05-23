"use client";

import { useEffect } from "react";
import { clearPendingCheckout } from "@/components/billing-buttons";

export function ClearPendingCheckout() {
  useEffect(() => {
    clearPendingCheckout();
  }, []);

  return null;
}
