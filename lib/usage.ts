import type { UsageSummary, PlanId } from "@/types/saas";

const defaultPlanLimits: Record<PlanId, number> = {
  free: 3,
  lite: 10,
  founder: 50,
  pro_creator: 50,
  pro_studio: 250
};

export function monthlyLimitForPlan(plan: PlanId) {
  if (plan === "lite") return defaultPlanLimits.lite;
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
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export function currentUsageWindow(now = new Date(), billingPeriodEnd?: string | null, billingPeriodStart?: string | null,
  transitionStart?: string | null, transitionEnd?: string | null) {
  const start = billingPeriodStart ? Date.parse(billingPeriodStart) : NaN;
  const end = billingPeriodEnd ? Date.parse(billingPeriodEnd) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && start < end && start <= now.getTime() && now.getTime() < end) {
    const transition = transitionEnd === billingPeriodEnd && transitionStart ? Date.parse(transitionStart) : NaN;
    const effectiveStart = Number.isFinite(transition) && transition <= now.getTime() && transition < end ? transition : start;
    return { periodStart: new Date(effectiveStart).toISOString(), periodEnd: new Date(end).toISOString() };
  }
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
  billingPeriodEnd?: string | null,
  billingPeriodStart?: string | null,
  transitionStart?: string | null,
  transitionEnd?: string | null
): UsageSummary {
  const limit = monthlyLimitForPlan(plan);
  const { periodStart, periodEnd } = currentUsageWindow(new Date(), billingPeriodEnd, billingPeriodStart, transitionStart, transitionEnd);

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
