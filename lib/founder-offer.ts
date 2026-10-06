export const FOUNDER_PROMOTION_CODE = "FOUNDING100";
export const FOUNDER_CHECKOUT_LOCK_MS = 2 * 60 * 1000;

export type FounderPromotionCode = {
  id?: string | null;
  code?: string | null;
  active?: boolean;
  max_redemptions?: number | null;
  times_redeemed?: number | null;
};

export type FounderDiscountConfig = {
  configuredCouponId?: string | null;
  configuredPromotionCodeId?: string | null;
};

export type FounderOfferAvailability = {
  promotionCodeId: string;
  maxRedemptions: number;
  timesRedeemed: number;
  remaining: number;
  canClaim: true;
};

export class FounderOfferUnavailableError extends Error {
  constructor(message = "Founder offer is not available.") {
    super(message);
    this.name = "FounderOfferUnavailableError";
  }
}

export function founderIntentQuery(plan?: string | null, founderOffer = false) {
  const requestedPlan = plan === "pro_creator" || plan === "pro_studio"
    ? plan
    : founderOffer ? "pro_creator" : null;

  if (!requestedPlan) {
    return founderOffer ? "?founder=1" : "";
  }

  return `?plan=${requestedPlan}${founderOffer ? "&founder=1" : ""}`;
}

export function founderLoginCallbackUrl(baseUrl: string, plan?: string | null, founderOffer = false) {
  return `${baseUrl}/login${founderIntentQuery(plan, founderOffer)}`;
}

export function authenticatedFounderDestination(founderOffer = false) {
  return founderOffer ? "/founder/checkout" : "/dashboard";
}

export function resolveFounderOfferAvailability(
  promotionCode: FounderPromotionCode | null | undefined,
  config: FounderDiscountConfig = {}
): FounderOfferAvailability {
  if (!promotionCode?.id || promotionCode.code !== FOUNDER_PROMOTION_CODE || promotionCode.active === false) {
    throw new FounderOfferUnavailableError("Founder promotion code is unavailable.");
  }

  const configuredPromotionCodeId = config.configuredPromotionCodeId?.trim();
  const configuredCouponId = config.configuredCouponId?.trim();

  if (configuredPromotionCodeId && configuredPromotionCodeId !== promotionCode.id) {
    throw new FounderOfferUnavailableError("Founder promotion code configuration does not match FOUNDING100.");
  }

  if (configuredCouponId) {
    if (!configuredCouponId.startsWith("promo_")) {
      throw new FounderOfferUnavailableError("Founder checkout must use the FOUNDING100 promotion code, not a direct coupon.");
    }

    if (configuredCouponId !== promotionCode.id) {
      throw new FounderOfferUnavailableError("Founder coupon configuration points to a different promotion code.");
    }
  }

  if (typeof promotionCode.max_redemptions !== "number") {
    throw new FounderOfferUnavailableError("Founder promotion code is missing a redemption limit.");
  }

  const timesRedeemed = promotionCode.times_redeemed ?? 0;
  const remaining = Math.max(0, promotionCode.max_redemptions - timesRedeemed);

  if (remaining <= 0) {
    throw new FounderOfferUnavailableError("All Founder places have been claimed.");
  }

  return {
    promotionCodeId: promotionCode.id,
    maxRedemptions: promotionCode.max_redemptions,
    timesRedeemed,
    remaining,
    canClaim: true
  };
}

export function founderCheckoutMetadata(userId?: string) {
  return {
    "metadata[offer]": "founder",
    "metadata[founder_offer]": "true",
    "metadata[expected_total]": "0",
    "subscription_data[metadata][offer]": "founder",
    "subscription_data[metadata][founder_offer]": "true",
    "subscription_data[metadata][expected_total]": "0",
    ...(userId
      ? {
        "metadata[user_id]": userId,
        "subscription_data[metadata][user_id]": userId
      }
      : {})
  };
}

export function founderCheckoutDiscountParams(promotionCodeId: string) {
  return {
    "discounts[0][promotion_code]": promotionCodeId,
    "payment_method_collection": "if_required",
    "expand[]": "discounts.promotion_code",
    ...founderCheckoutMetadata()
  };
}

export function checkoutSessionPromotionCodeIds(session: {
  discounts?: Array<{ promotion_code?: string | { id?: string | null } | null }>;
  total_details?: {
    breakdown?: {
      discounts?: Array<{
        discount?: {
          promotion_code?: string | { id?: string | null } | null;
        };
      }>;
    };
  };
}) {
  const ids = new Set<string>();
  const collect = (value?: string | { id?: string | null } | null) => {
    if (typeof value === "string" && value) ids.add(value);
    if (typeof value === "object" && value?.id) ids.add(value.id);
  };

  session.discounts?.forEach((discount) => collect(discount.promotion_code));
  session.total_details?.breakdown?.discounts?.forEach((item) => collect(item.discount?.promotion_code));

  return ids;
}

export function founderCheckoutSessionIsValid(session: {
  amount_total?: number | null;
  metadata?: Record<string, string>;
  customer?: string | null;
  subscription?: string | null;
  discounts?: Array<{ promotion_code?: string | { id?: string | null } | null }>;
  total_details?: {
    breakdown?: {
      discounts?: Array<{
        discount?: {
          promotion_code?: string | { id?: string | null } | null;
        };
      }>;
    };
  };
}, expectedPromotionCodeId: string) {
  return (
    session.metadata?.offer === "founder" &&
    session.metadata?.founder_offer === "true" &&
    session.metadata?.expected_total === "0" &&
    session.amount_total === 0 &&
    Boolean(session.customer) &&
    Boolean(session.subscription) &&
    checkoutSessionPromotionCodeIds(session).has(expectedPromotionCodeId)
  );
}

export function founderWebhookCheckoutQualifies(session: {
  amount_total?: number | null;
  metadata?: Record<string, string>;
  customer?: string | null;
  subscription?: string | null;
}) {
  return (
    session.metadata?.offer === "founder" &&
    session.metadata?.founder_offer === "true" &&
    session.metadata?.expected_total === "0" &&
    session.amount_total === 0 &&
    Boolean(session.customer) &&
    Boolean(session.subscription)
  );
}

export function founderSubscriptionMetadataQualifies(metadata?: Record<string, string>) {
  return (
    metadata?.offer === "founder" &&
    metadata?.founder_offer === "true" &&
    metadata?.expected_total === "0"
  );
}

export function founderSubscriptionEntitlementState(input: {
  customer?: string | null;
  subscription?: string | null;
  sessionId?: string | null;
}) {
  return {
    plan: "founder" as const,
    status: "active" as const,
    stripeCustomerId: input.customer ?? undefined,
    stripeSubscriptionId: input.subscription ?? undefined,
    stripeCheckoutSessionId: input.sessionId ?? undefined,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    entitlementSource: "founder_offer",
    amountPaid: input.sessionId ? 0 : undefined
  };
}

export function founderClaimConflict(profile?: {
  plan?: string | null;
  subscription_status?: string | null;
  entitlement_source?: string | null;
} | null) {
  if (!profile) {
    return null;
  }

  if (
    profile.entitlement_source === "founder_offer" &&
    profile.plan === "founder" &&
    profile.subscription_status === "active"
  ) {
    return {
      status: 409,
      error: "Your lifetime access already includes this plan.",
      redirectUrl: "/dashboard"
    };
  }

  if (
    profile.subscription_status === "active" &&
    profile.plan &&
    profile.plan !== "free"
  ) {
    return {
      status: 409,
      error: "Your active account already includes paid access.",
      redirectUrl: "/dashboard"
    };
  }

  return null;
}

export function createFounderClaimGate(clock = () => Date.now()) {
  const locks = new Map<string, number>();

  return {
    async run<T>(key: string, work: () => Promise<T>) {
      const now = clock();
      const existing = locks.get(key);

      if (existing && existing > now) {
        throw new FounderOfferUnavailableError("A Founder checkout is already being prepared for this account.");
      }

      locks.set(key, now + FOUNDER_CHECKOUT_LOCK_MS);

      try {
        return await work();
      } finally {
        locks.delete(key);
      }
    }
  };
}
