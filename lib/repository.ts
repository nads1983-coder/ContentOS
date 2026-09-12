import "server-only";
import { usesPostgres } from "@/lib/backend";
import type * as Legacy from "@/lib/appwrite-rest";
async function repository() { return usesPostgres() ? import("@/lib/postgres-repository") : import("@/lib/appwrite-rest"); }
export async function getUserProfile(...args: Parameters<typeof Legacy.getUserProfile>) { return (await repository()).getUserProfile(...args); }
export async function getUserProfileByEmail(...args: Parameters<typeof Legacy.getUserProfileByEmail>) { return (await repository()).getUserProfileByEmail(...args); }
export async function getUserProfileForUser(...args: Parameters<typeof Legacy.getUserProfileForUser>) { return (await repository()).getUserProfileForUser(...args); }
export async function upsertUserProfile(...args: Parameters<typeof Legacy.upsertUserProfile>) { return (await repository()).upsertUserProfile(...args); }
export async function listBrandProfiles(...args: Parameters<typeof Legacy.listBrandProfiles>) { return (await repository()).listBrandProfiles(...args); }
export async function createBrandProfile(...args: Parameters<typeof Legacy.createBrandProfile>) { return (await repository()).createBrandProfile(...args); }
export async function deleteBrandProfile(...args: Parameters<typeof Legacy.deleteBrandProfile>) { return (await repository()).deleteBrandProfile(...args); }
export async function saveOnboarding(...args: Parameters<typeof Legacy.saveOnboarding>) { return (await repository()).saveOnboarding(...args); }
export async function recordGeneration(...args: Parameters<typeof Legacy.recordGeneration>) { return (await repository()).recordGeneration(...args); }
export async function recordUsageEvent(...args: Parameters<typeof Legacy.recordUsageEvent>) { return (await repository()).recordUsageEvent(...args); }
export async function getMonthlyUsageCount(...args: Parameters<typeof Legacy.getMonthlyUsageCount>) { return (await repository()).getMonthlyUsageCount(...args); }
export async function updateSubscriptionStatus(...args: Parameters<typeof Legacy.updateSubscriptionStatus>) { return (await repository()).updateSubscriptionStatus(...args); }
export async function syncUserSubscriptionState(...args: Parameters<typeof Legacy.syncUserSubscriptionState>) { return (await repository()).syncUserSubscriptionState(...args); }
