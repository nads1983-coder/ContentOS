// Server-side admission policy. The receipt is an operator attestation, not an
// automatic deployment verifier; never create it before approved launch checks.
export function founderOfferRetired(receipt = process.env.FOUNDER_RETIREMENT_RECEIPT, now = Date.now()) {
  if (!receipt || receipt.length > 2048 || !Number.isFinite(now)) return false;
  try {
    const value = JSON.parse(receipt);
    if (!value || value.version !== 1 || value.launchApproval !== "explicit-owner-approval" ||
      value.verification !== "passed" || !/^[a-f0-9]{40}$/.test(value.approvedRelease ?? "") ||
      value.approvedRelease !== value.verifiedRelease || !/^dpl_[A-Za-z0-9]+$/.test(value.productionDeployment ?? "")) return false;
    const dates = [value.verifiedAt, value.retiredAt];
    if (dates.some(date => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date)) return false;
    return Date.parse(value.verifiedAt) <= Date.parse(value.retiredAt) && Date.parse(value.retiredAt) <= now;
  } catch { return false; }
}

export const founderRetiredMessage = "The Founding 100 offer has closed. Existing Founder lifetime access is unchanged.";
