import type { UserProfile } from "@/types/saas";

export const MANUAL_LIFETIME_ENTITLEMENT_SOURCE = "manual_lifetime_upgrade_cousin";

export function hasManualLifetimeEntitlement(profile: UserProfile | null | undefined) {
  return Boolean(
    profile &&
      profile.entitlement_source === MANUAL_LIFETIME_ENTITLEMENT_SOURCE &&
      profile.plan === "pro_studio" &&
      profile.subscription_status === "active" &&
      !profile.subscription_current_period_end
  );
}
