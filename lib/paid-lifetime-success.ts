import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfileForUser } from "@/lib/repository";
import { getPaidLifetimeReservation } from "@/lib/paid-lifetime-reservations";
import { retrieveCheckoutSession } from "@/lib/stripe-rest";
import { hasPaidCreatorLifetimeEntitlement } from "@/lib/entitlements";

export async function paidLifetimeSuccessMessage(sessionId: string | undefined) {
  const pending = "Sign in to the purchasing account and check your dashboard for payment status.";
  if (!sessionId?.startsWith("cs_")) return pending;
  try {
    const user = await getCurrentUser();
    if (!user) return pending;
    const session = await retrieveCheckoutSession(sessionId);
    if (session.metadata?.offer !== "creator_lifetime_2026" || !session.metadata.purchase_id) return pending;
    const claim = await getPaidLifetimeReservation(session.metadata.purchase_id);
    if (!claim || claim.userId !== user.id || claim.stripeCheckoutSessionId !== sessionId) return pending;
    const profile = await getUserProfileForUser(user.id,user.email);
    if (claim.status === "completed" && hasPaidCreatorLifetimeEntitlement(profile) &&
        profile?.paid_creator_lifetime_purchase_id === claim.id) {
      return "Your Creator lifetime access is active: 50 AI text generations per month, no AI image generations. This was a one-time payment with no recurring subscription.";
    }
    if (["refunded","disputed","review"].includes(claim.status)) return "This lifetime purchase has been reversed or requires payment review. Contact support; any separate subscription is unchanged.";
    if (["expired","failed","canceled","invalid"].includes(claim.status)) return "This checkout did not activate lifetime access. Check your dashboard before starting another payment.";
    return "Your lifetime payment is being verified. Access will appear on your dashboard after verification; please do not pay again.";
  } catch {
    return "Payment status is temporarily unavailable. Check your dashboard before starting another payment.";
  }
}
