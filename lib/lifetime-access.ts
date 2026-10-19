import type { UserProfile } from "@/types/saas";

export type LifetimeAccess = { status: "active" | "revoked" | "disputed"; textCredits: number; imageCredits: number; source: "lifetime_purchase" };
// Separate from Founder, complimentary owner and recurring billing fields.
export function lifetimeAccess(data: UserProfile): LifetimeAccess | null {
  const value = data.lifetime_access;
  return value?.source === "lifetime_purchase" && value.status === "active" && value.textCredits === 12 && value.imageCredits === 4 ? value : null;
}
export function usesLifetimeCredits(data: UserProfile, now = new Date()) {
  const recurringActive = data.plan !== "free" && ["active", "trialing"].includes(data.subscription_status) &&
    (!data.subscription_current_period_end || Date.parse(data.subscription_current_period_end) > now.getTime());
  return Boolean(lifetimeAccess(data) && !recurringActive);
}

// Deliberately not an environment toggle: enable only in an owner-reviewed release.
export const LIFETIME_CHECKOUT_ENABLED = false;
