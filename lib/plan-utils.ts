import { PlanId } from "@/types/saas";
import { BillingPlan } from "@/lib/pricing";

export function planRank(plan: PlanId | BillingPlan) {
  if (plan === "pro_studio") {
    return 2;
  }

  if (plan === "founder" || plan === "pro_creator") {
    return 1;
  }

  return 0;
}

export function planCoversPlan(currentPlan: PlanId, requestedPlan: BillingPlan) {
  return planRank(currentPlan) >= planRank(requestedPlan);
}
