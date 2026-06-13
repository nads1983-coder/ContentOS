import type { UsageSummary, PlanId } from "@/types/saas";

const defaultPlanLimits: Record<PlanId, number> = {
  free: 3,
  founder: 100,
  pro_creator: 100,
  pro_studio: 500
};

export function monthlyLimitForPlan(plan: PlanId) {
  if (plan === "pro_studio") {
    return defaultPlanLimits.pro_studio;
  }

  if (plan === "founder" || plan === "pro_creator") {
    return defaultPlanLimits.pro_creator;
  }

  return defaultPlanLimits.free;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function currentUsageWindow(now = new Date(), billingPeriodEnd?: string | null) {
  if (billingPeriodEnd) {
    const renewalDate = new Date(billingPeriodEnd);

    if (!Number.isNaN(renewalDate.getTime())) {
      let periodEnd = renewalDate;

      while (periodEnd <= now) {
        periodEnd = addMonths(periodEnd, 1);
      }

      return {
        periodStart: addMonths(periodEnd, -1).toISOString(),
        periodEnd: periodEnd.toISOString()
      };
    }
  }

  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  };
}

export function buildUsageSummary(
  plan: PlanId,
  used: number,
  billingPeriodEnd?: string | null
): UsageSummary {
  const limit = monthlyLimitForPlan(plan);
  const { periodStart, periodEnd } = currentUsageWindow(new Date(), billingPeriodEnd);

  return {
    plan,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    periodStart,
    periodEnd
  };
}

export function canGenerateWithPlan(summary: UsageSummary) {
  return summary.remaining > 0;
}
