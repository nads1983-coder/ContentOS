import type { UserProfile } from "@/types/saas";

export const MANUAL_LIFETIME_ENTITLEMENT_SOURCE = "manual_lifetime_upgrade_cousin";
export const FOUNDER_OFFER_ENTITLEMENT_SOURCE = "founder_offer";

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
  if (hasManualLifetimeEntitlement(profile)) {
    return true;
  }

  return Boolean(
    profile &&
      profile.entitlement_source === FOUNDER_OFFER_ENTITLEMENT_SOURCE &&
      profile.plan === "founder" &&
      profile.subscription_status === "active"
  );
}
