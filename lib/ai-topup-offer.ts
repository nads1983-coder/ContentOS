/** Approved package definitions. Checkout and credit issuance are not implemented.
 * Never enable sales until the ledger, reversal handling and funding are verified. */
export const AI_TOPUP_OFFER = {
  currency: "gbp",
  checkoutEnabled: false,
  packages: {
    starter: { pricePence: 500, credits: 25 },
    popular: { pricePence: 900, credits: 50 },
    power: { pricePence: 1500, credits: 100 }
  }
} as const;

export type AITopupPackage = keyof typeof AI_TOPUP_OFFER.packages;

export function getAITopupPackage(id: string) {
  if (!Object.hasOwn(AI_TOPUP_OFFER.packages, id)) throw new RangeError("Unknown AI top-up package.");
  return AI_TOPUP_OFFER.packages[id as AITopupPackage];
}

/** A client flag or configuration alone must never enable an unfinished sale. */
export function assertAITopupCheckoutEnabled() {
  if (!AI_TOPUP_OFFER.checkoutEnabled) throw new Error("AI top-up checkout is unavailable.");
}
