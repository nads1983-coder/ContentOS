import type { UserProfile } from "@/types/saas";

export const MANUAL_LIFETIME_ENTITLEMENT_SOURCE = "manual_lifetime_upgrade_cousin";
export const FOUNDER_OFFER_ENTITLEMENT_SOURCE = "founder_offer";
export const OWNER_COMPLIMENTARY_ENTITLEMENT_SOURCE = "owner_complimentary_lifetime";

/** Kept independent of recurring Stripe subscriptions and legacy Founder claims. */
export function hasPaidCreatorLifetimeEntitlement(profile: UserProfile | null | undefined) {
  return Boolean(profile && profile.paid_creator_lifetime_status === "active" &&
    typeof profile.paid_creator_lifetime_purchase_id === "string" &&
    profile.paid_creator_lifetime_purchase_id.length > 0);
}

export function paidCreatorLifetimeIsPrimary(profile: UserProfile | null | undefined, now = new Date()) {
  if (!hasPaidCreatorLifetimeEntitlement(profile) || !profile) return false;
  if (hasLifetimeEntitlement(profile)) return false;
  // Preserve the higher subscription tier while it remains paid/current.
  if (profile.plan === "pro_studio" && ["active","trialing"].includes(profile.subscription_status) &&
    (!profile.subscription_current_period_end || Date.parse(profile.subscription_current_period_end) > now.getTime())) return false;
  return true;
}

export function hasOwnerComplimentaryEntitlement(profile: UserProfile | null | undefined) {
  return Boolean(profile &&
    profile.entitlement_source === OWNER_COMPLIMENTARY_ENTITLEMENT_SOURCE &&
    profile.plan === "pro_studio" && profile.subscription_status === "active" &&
    !profile.subscription_current_period_end);
}

export function hasManualLifetimeEntitlement(profile: UserProfile | null | undefined) {
  return Boolean(
    profile &&
      profile.entitlement_source === MANUAL_LIFETIME_ENTITLEMENT_SOURCE &&
      profile.plan === "pro_studio" &&
      profile.subscription_status === "active" &&
      !profile.subscription_current_period_end
  );
}

export function hasLifetimeEntitlement(profile: UserProfile | null | undefined) {
  if (hasManualLifetimeEntitlement(profile) || hasOwnerComplimentaryEntitlement(profile)) {
    return true;
  }

  return Boolean(
    profile &&
      profile.entitlement_source === FOUNDER_OFFER_ENTITLEMENT_SOURCE &&
      profile.plan === "founder" &&
      profile.subscription_status === "active"
  );
}
