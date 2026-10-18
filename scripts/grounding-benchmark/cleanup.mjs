// No network or credentials here: adapters perform bounded, campaign-scoped operations.
export function isDeploymentNotFound(result) {
  if (result.status === 0) return false;
  for (const text of [result.stdout, result.stderr]) {
    if (typeof text !== "string") continue;
    try {
      const parsed = JSON.parse(text);
      if (["not_found", "deployment_not_found"].includes(String(parsed?.error?.code).toLowerCase()) || parsed?.error?.status === 404) return true;
    } catch { /* CLI errors can be formatted text rather than JSON. */ }
    if (/\bHTTP(?:\/[\d.]+)?\s+404\b|\bstatus(?: code)?[:= ]+404\b|\(404\)/i.test(text)) return true;
  }
  return false;
}

export function matchesCampaign(deployment, projectId, planHash) {
  return !!deployment && typeof deployment.id === "string" && /^dpl_[A-Za-z0-9]+$/.test(deployment.id) &&
    deployment.projectId === projectId && (deployment.target === null || deployment.target === "preview") &&
    deployment.meta?.benchmarkPlanHash === planHash;
}

export async function cleanupCampaign({ projectId, planHash, attempted, knownDeployments = [], databaseSteps,
  exportAudit, listDeployments, getDeployment, deleteDeployment, rememberDeployment }) {
  const result = { database: {}, auditExported: false, discoveryComplete: false,
    verifiedDeployments: [], deletedDeploymentIds: [], errors: [], safeToEraseRecovery: false };
  const error = code => { if (!result.errors.includes(code)) result.errors.push(code); };
  // Revocation, session termination and evidence export must not depend on one another succeeding.
  for (const [name, action] of Object.entries(databaseSteps)) {
    try { await action(); result.database[name] = true; }
    catch { result.database[name] = false; error(`database_${name}_failed`); }
  }
  try { await exportAudit(); result.auditExported = true; } catch { error("audit_export_failed"); }
  if (typeof planHash !== "string" || !/^[a-f0-9]{64}$/.test(planHash)) {
    error("missing_campaign_identity"); return result;
  }

  const candidates = new Map();
  for (const deployment of knownDeployments) {
    if (deployment && typeof deployment.id === "string" && /^dpl_[A-Za-z0-9]+$/.test(deployment.id)) candidates.set(deployment.id, deployment);
  }
  let cursor = null;
  const cursors = new Set();
  try {
    for (let page = 0; page < 20; page++) {
      const response = await listDeployments(cursor);
      if (!response || !Array.isArray(response.deployments) || response.deployments.length > 100 ||
        !(response.next === null || (typeof response.next === "number" && Number.isSafeInteger(response.next) && response.next >= 0) ||
          (typeof response.next === "string" && /^\d{1,20}$/.test(response.next)))) throw new Error("invalid_list");
      // Server-side filtering is only an optimization. Never trust it as deletion authorization.
      for (const deployment of response.deployments) {
        if (deployment?.meta?.benchmarkPlanHash !== planHash) continue;
        const id = deployment.id ?? deployment.uid;
        if (typeof id !== "string" || !/^dpl_[A-Za-z0-9]+$/.test(id)) throw new Error("invalid_identity");
        if (!candidates.has(id)) candidates.set(id, { ...deployment, id });
      }
      if (response.next === null) { result.discoveryComplete = true; break; }
      if (cursors.has(String(response.next))) throw new Error("repeated_cursor");
      cursors.add(String(response.next)); cursor = response.next;
    }
    if (!result.discoveryComplete) error("deployment_discovery_truncated");
  } catch { error("deployment_discovery_failed"); }

  for (const [id, recorded] of candidates) {
    let current;
    try { current = await getDeployment(id); }
    catch { error("deployment_lookup_failed"); continue; }
    if (current === null) {
      // A previous cleanup may have deleted it before losing its acknowledgement.
      if (matchesCampaign(recorded, projectId, planHash)) result.deletedDeploymentIds.push(id);
      else error("unverified_missing_deployment");
      continue;
    }
    if (!matchesCampaign(current, projectId, planHash) || current.id !== id) {
      error("unsafe_deletion_target"); continue;
    }
    const verified = { id, projectId: current.projectId, target: current.target, meta: { benchmarkPlanHash: planHash } };
    result.verifiedDeployments.push(verified);
    // Record identity before deletion so a later invocation can reconcile a lost acknowledgement.
    try { await rememberDeployment(verified); } catch { error("identity_journal_failed"); }
    try { await deleteDeployment(id); } catch { /* Verify state even if DELETE acknowledgement was lost. */ }
    try {
      if (await getDeployment(id) === null) result.deletedDeploymentIds.push(id);
      else error("deployment_deletion_unconfirmed");
    } catch { error("deployment_deletion_unconfirmed"); }
  }
  // A submitted build may not yet appear in the listing. An empty list never proves non-submission.
  if (attempted && result.deletedDeploymentIds.length === 0) error("deployment_identity_unresolved");
  result.safeToEraseRecovery = result.errors.length === 0 && result.discoveryComplete && result.auditExported &&
    Object.keys(result.database).length > 0 && Object.values(result.database).every(Boolean) &&
    result.deletedDeploymentIds.length === candidates.size;
  return result;
}
