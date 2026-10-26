export type BillingPlan = "lite" | "pro_creator" | "pro_studio";

export type MarketingPlan = {
  name: string;
  price: string;
  schemaPrice?: string;
  body: string;
  socialProof?: string;
  offerNote?: string;
  badge?: string;
  items: string[];
  cta: string;
  billingPlan?: BillingPlan;
  featured?: boolean;
};

export const pricingPlans: MarketingPlan[] = [
  {
    name: "Free",
    price: "£0",
    schemaPrice: "0",
    body: "For testing the workflow and creating core post formats.",
    items: ["Basic generation", "Limited monthly generations", "Core post formats"],
    cta: "Start creating"
  },
  {
    name: "Lite",
    price: "£5/month",
    schemaPrice: "5",
    billingPlan: "lite",
    body: "For occasional creators who want the complete text creation workflow.",
    items: [
      "10 pooled text generations/refinements per month",
      "All 14 content formats",
      "Brand preferences and natural-language refinement",
      "Editing, saving, copying and exporting",
      "No AI image generation"
    ],
    cta: "Choose Lite"
  },
  {
    name: "Pro Creator",
    price: "£9/month",
    schemaPrice: "9",
    billingPlan: "pro_creator",
    body: "AI social content generation for creators, founders and consultants.",
    socialProof: "Trusted by creators building consistently online.",
    badge: "Most Popular",
    items: [
      "50 generations/month",
      "Multi-platform outputs",
      "Repurposing packs",
      "Carousel and video scripts",
      "Formatter tools",
      "Saved library",
      "Export tools",
      "Writing style memory"
    ],
    featured: true,
    cta: "Start Creating"
  },
  {
    name: "Pro Studio",
    price: "£39/month",
    schemaPrice: "39",
    billingPlan: "pro_studio",
    body: "Advanced AI social content workspace for agencies, teams and high-volume creators.",
    socialProof: "Built for serious creators, consultants and growing brands.",
    items: [
      "250 generations/month",
      "Multiple brand profiles",
      "Workspace organization",
      "Advanced workflows",
      "AI image generation",
      "Downloadable PNG visuals",
      "Social graphic generation",
      "Future team support ready"
    ],
    cta: "Scale Your Workflow"
  }
];
