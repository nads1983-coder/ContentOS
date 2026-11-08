import { COST_POLICY, conservativeGBP } from "@/lib/ai-cost";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";

// No recurring revenue is assumed from one-time receipts. Protect the entire
// incumbent budget until a separately reviewed capacity allocation exists.
export const LIFETIME_CAPACITY = { protectedMonthlyMicroGBP: COST_POLICY.monthly } as const;
export function lifetimeMonthlyLiability() {
  const maximumCall = conservativeGBP(Math.ceil(((COST_POLICY.textBytes + 4096) * 7 + 24000 * 56) / 4));
  return maximumCall * PAID_LIFETIME_OFFER.monthlyTextGenerations;
}
export function fundedLifetimePlaces(protectedMicroGBP: number, committed: number, now = new Date()) {
  if (!Number.isSafeInteger(protectedMicroGBP) || protectedMicroGBP < 0 ||
      protectedMicroGBP > COST_POLICY.monthly || !Number.isSafeInteger(committed) || committed < 0 ||
      now >= new Date(COST_POLICY.expires)) return 0;
  return Math.max(0, Math.floor((COST_POLICY.monthly - protectedMicroGBP) / lifetimeMonthlyLiability()) - committed);
}
export function assertLifetimeCapacity(committed: number) {
  if (fundedLifetimePlaces(LIFETIME_CAPACITY.protectedMonthlyMicroGBP, committed) === 0) {
    throw new Error("Lifetime sales await funded monthly capacity. No payment was started.");
  }
}
