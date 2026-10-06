export type FounderClaimStatus = "preparing" | "open" | "completed" | "expired" | "canceled" | "invalid" | "failed";

export type FounderClaim = {
  id: string;
  userId: string;
  email: string;
  status: FounderClaimStatus;
  attemptKey: string;
  promotionCodeId: string;
  stripeCheckoutSessionId?: string | null;
  stripeCheckoutUrl?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  amountTotal?: number | null;
  expiresAt?: string | null;
};

export type FounderSession = {
  id: string;
  url?: string | null;
  amount_total?: number | null;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string>;
  expires_at?: number | null;
  discounts?: Array<{ promotion_code?: string | { id?: string | null } | null }>;
  total_details?: {
    breakdown?: {
      discounts?: Array<{
        discount?: {
          promotion_code?: string | { id?: string | null } | null;
        };
      }>;
    };
  };
};

export type FounderCheckoutRepository = {
  getActiveClaim(userId: string): Promise<FounderClaim | null>;
  reserveClaim(input: {
    userId: string;
    email: string;
    promotionCodeId: string;
  }): Promise<FounderClaim>;
  saveOpenSession(input: {
    claimId: string;
    stripeCheckoutSessionId: string;
    stripeCheckoutUrl: string;
    amountTotal: number;
    expiresAt?: string | null;
  }): Promise<FounderClaim>;
  markTerminal(input: {
    claimId: string;
    status: Exclude<FounderClaimStatus, "preparing" | "open">;
    error?: string;
  }): Promise<void>;
  findClaimBySession(sessionId: string): Promise<FounderClaim | null>;
  findActiveClaimForUser(userId: string): Promise<FounderClaim | null>;
  findCompletedClaimBySubscription(subscriptionId: string): Promise<FounderClaim | null>;
  completeClaim(input: {
    claimId: string;
    stripeCheckoutSessionId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    amountTotal: number;
  }): Promise<void>;
};

export type FounderCheckoutStripe = {
  resolvePromotionCode(): Promise<{ promotionCodeId: string }>;
  createCheckoutSession(input: {
    userId: string;
    email: string;
    stripeCustomerId?: string | null;
    promotionCodeId: string;
    idempotencyKey: string;
  }): Promise<FounderSession>;
  retrieveCheckoutSession(sessionId: string): Promise<FounderSession>;
  expireCheckoutSession(sessionId: string): Promise<void>;
  scheduleCancellation(subscriptionId: string): Promise<void>;
};

export type FounderCheckoutDeps = {
  repository: FounderCheckoutRepository;
  stripe: FounderCheckoutStripe;
  validateOpenSession(session: FounderSession, promotionCodeId: string): boolean;
  validateCompletedSession(session: FounderSession, promotionCodeId: string, userId: string): boolean;
  persistFounderEntitlement(input: {
    userId: string;
    email: string;
    sessionId: string;
    customerId: string;
    subscriptionId: string;
    amountTotal: number;
  }): Promise<void>;
};

export class FounderClaimConflictError extends Error {
  status = 409;
  redirectUrl = "/dashboard";

  constructor(message: string) {
    super(message);
    this.name = "FounderClaimConflictError";
  }
}

export class FounderCheckoutUnavailableError extends Error {
  status = 409;

  constructor(message: string) {
    super(message);
    this.name = "FounderCheckoutUnavailableError";
  }
}

function terminalStatusForStripeStatus(status?: string | null): Exclude<FounderClaimStatus, "preparing" | "open"> | null {
  if (status === "complete") return "completed";
  if (status === "expired") return "expired";
  return null;
}

function isoFromStripeTimestamp(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

async function expireInvalidSession(deps: FounderCheckoutDeps, session: FounderSession) {
  if (session.status !== "open") {
    return;
  }

  try {
    await deps.stripe.expireCheckoutSession(session.id);
  } catch (error) {
    console.error("[Founder Checkout] Failed to expire invalid open session", {
      sessionId: session.id,
      error: error instanceof Error ? error.message : "Unknown Stripe error"
    });
  }
}

export async function startFounderCheckout(input: {
  userId: string;
  email: string;
  stripeCustomerId?: string | null;
  alreadyEntitled?: boolean;
  alreadyPaid?: boolean;
}, deps: FounderCheckoutDeps) {
  if (input.alreadyEntitled) {
    throw new FounderClaimConflictError("Your lifetime access already includes this plan.");
  }

  if (input.alreadyPaid) {
    throw new FounderClaimConflictError("Your active account already includes paid access.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let claim = await deps.repository.getActiveClaim(input.userId);

    if (!claim) {
      const offer = await deps.stripe.resolvePromotionCode();
      claim = await deps.repository.reserveClaim({
        userId: input.userId,
        email: input.email,
        promotionCodeId: offer.promotionCodeId
      });
    }

    if (claim.stripeCheckoutSessionId) {
      const session = await deps.stripe.retrieveCheckoutSession(claim.stripeCheckoutSessionId);

      if (deps.validateOpenSession(session, claim.promotionCodeId)) {
        await deps.repository.saveOpenSession({
          claimId: claim.id,
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url ?? "",
          amountTotal: session.amount_total ?? 0,
          expiresAt: isoFromStripeTimestamp(session.expires_at)
        });
        return { url: session.url };
      }

      if (deps.validateCompletedSession(session, claim.promotionCodeId, input.userId)) {
        await activateCompletedFounderCheckout(session, claim, deps);
        throw new FounderClaimConflictError("Your lifetime access already includes this plan.");
      }

      const terminalStatus = terminalStatusForStripeStatus(session.status) ?? "invalid";
      await expireInvalidSession(deps, session);
      await deps.repository.markTerminal({
        claimId: claim.id,
        status: terminalStatus,
        error: terminalStatus === "invalid" ? "Stored Founder checkout session failed validation." : undefined
      });

      if (terminalStatus === "invalid") {
        throw new FounderCheckoutUnavailableError("Founder checkout could not be validated. Please try again later.");
      }

      continue;
    }

    let createdSession: FounderSession;

    try {
      createdSession = await deps.stripe.createCheckoutSession({
        userId: input.userId,
        email: input.email,
        stripeCustomerId: input.stripeCustomerId,
        promotionCodeId: claim.promotionCodeId,
        idempotencyKey: claim.attemptKey
      });
    } catch (error) {
      await deps.repository.markTerminal({
        claimId: claim.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Stripe checkout creation failed."
      });
      throw error;
    }

    const session = await deps.stripe.retrieveCheckoutSession(createdSession.id);

    if (!deps.validateOpenSession(session, claim.promotionCodeId)) {
      const terminalStatus = terminalStatusForStripeStatus(session.status) ?? "invalid";
      await expireInvalidSession(deps, session);
      await deps.repository.markTerminal({
        claimId: claim.id,
        status: terminalStatus,
        error: "New Founder checkout session failed validation."
      });
      if (terminalStatus === "expired") {
        continue;
      }
      throw new FounderCheckoutUnavailableError("Founder checkout could not be validated. Please try again later.");
    }

    await deps.repository.saveOpenSession({
      claimId: claim.id,
      stripeCheckoutSessionId: session.id,
      stripeCheckoutUrl: session.url ?? "",
      amountTotal: session.amount_total ?? 0,
      expiresAt: isoFromStripeTimestamp(session.expires_at)
    });

    return { url: session.url };
  }

  throw new FounderCheckoutUnavailableError("Founder checkout could not be prepared. Please try again.");
}

export async function activateCompletedFounderCheckout(
  session: FounderSession,
  claim: FounderClaim,
  deps: FounderCheckoutDeps
) {
  if (!deps.validateCompletedSession(session, claim.promotionCodeId, claim.userId)) {
    await deps.repository.markTerminal({
      claimId: claim.id,
      status: "invalid",
      error: "Completed Founder checkout failed validation."
    });
    throw new FounderCheckoutUnavailableError("Founder checkout completion could not be validated.");
  }

  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (!customerId || !subscriptionId) {
    await deps.repository.markTerminal({
      claimId: claim.id,
      status: "invalid",
      error: "Completed Founder checkout was missing customer or subscription evidence."
    });
    throw new FounderCheckoutUnavailableError("Founder checkout completion was incomplete.");
  }

  await deps.stripe.scheduleCancellation(subscriptionId);
  await deps.persistFounderEntitlement({
    userId: claim.userId,
    email: claim.email,
    sessionId: session.id,
    customerId,
    subscriptionId,
    amountTotal: session.amount_total ?? 0
  });
  await deps.repository.completeClaim({
    claimId: claim.id,
    stripeCheckoutSessionId: session.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    amountTotal: session.amount_total ?? 0
  });
}

export async function handleFounderCheckoutCompleted(input: {
  sessionId: string;
  userId?: string | null;
}, deps: FounderCheckoutDeps) {
  const session = await deps.stripe.retrieveCheckoutSession(input.sessionId);
  let claim = await deps.repository.findClaimBySession(input.sessionId);
  const sessionUserId = input.userId ?? session.client_reference_id ?? session.metadata?.user_id ?? null;

  if (!claim && sessionUserId) {
    claim = await deps.repository.findActiveClaimForUser(sessionUserId);
  }

  if (!claim) {
    throw new FounderCheckoutUnavailableError("Founder checkout claim record was not found.");
  }

  if (claim.status === "completed") {
    return;
  }

  await activateCompletedFounderCheckout(session, claim, deps);
}

export async function handleFounderSubscriptionEvent(input: {
  subscriptionId?: string | null;
}, deps: FounderCheckoutDeps) {
  if (!input.subscriptionId) {
    return false;
  }

  const claim = await deps.repository.findCompletedClaimBySubscription(input.subscriptionId);
  return Boolean(claim);
}
