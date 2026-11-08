/** The paid Creator lifetime offer is distinct from the retired Founding 100. */
export const PAID_LIFETIME_OFFER = {
  code: "creator_lifetime_2026",
  earlyBirdPricePence: 9_900,
  standardPricePence: 14_900,
  earlyBirdPlaces: 25,
  monthlyTextGenerations: 50,
  monthlyAiImages: 0,
  currency: "gbp",
  /** Never infer launch readiness from environment configuration alone. */
  checkoutEnabled: false,
  /** Keep this on after the first sale, even if new checkout is later closed. */
  fulfillmentEnabled: false
} as const;

/** Count completed, non-reversed lifetime purchases, not checkout attempts. */
export function lifetimePriceForCompletedSales(completedSales: number) {
  if (!Number.isSafeInteger(completedSales) || completedSales < 0) {
    throw new RangeError("Completed lifetime sales must be a non-negative integer.");
  }
  return completedSales < PAID_LIFETIME_OFFER.earlyBirdPlaces
    ? PAID_LIFETIME_OFFER.earlyBirdPricePence
    : PAID_LIFETIME_OFFER.standardPricePence;
}

/** Display only: the authoritative price must be reserved in a DB transaction. */
export function lifetimePlacesRemaining(completedSales: number) {
  lifetimePriceForCompletedSales(completedSales);
  return Math.max(0, PAID_LIFETIME_OFFER.earlyBirdPlaces - completedSales);
}
