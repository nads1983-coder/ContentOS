export type PlanId = "free" | "founder" | "pro_creator" | "pro_studio";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export type BrandProfile = {
  id: string;
  user_id?: string;
  name: string;
  audience: string;
  offer: string;
  tone: string;
  cta_style: string;
  preferred_platforms: string[];
  writing_preferences: string;
  created_at?: string;
  updated_at?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  plan: PlanId;
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  subscription_canceled_at?: string | null;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UsageSummary = {
  plan: PlanId;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
};

export type OnboardingData = {
  businessName: string;
  audience: string;
  niche: string;
  goals: string;
  preferredPlatforms: string[];
  writingTone: string;
};
