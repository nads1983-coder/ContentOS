import { UsageSummary, PlanId } from "@/types/saas";

const planLimits: Record<PlanId, number> = {
  free: 10,
  pro_creator: 1000,
  pro_studio: 5000
};

export function currentUsageWindow(now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  };
}

export function buildUsageSummary(plan: PlanId, used: number): UsageSummary {
  const limit = planLimits[plan];
  const { periodStart, periodEnd } = currentUsageWindow();

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
