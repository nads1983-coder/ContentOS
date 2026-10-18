import type { GenerationInput } from "@/lib/generation-contract";
import type { GenerationProgress } from "@/lib/generation-progress";
import { generationProgressMessage } from "@/lib/generation-progress";
import type { GenerationResult } from "@/types/content";

export type GenerationAttempt = {
  id: string; fingerprint: string; payload: GenerationInput; stage?: string; createdAt: number;
};
export class GenerationClientError extends Error {
  constructor(message: string, readonly code = "network_interrupted") { super(message); }
}
const key = (account: string) => `contentos:generation-attempt:${account}`;
export function storeGenerationAttempt(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, account: string, attempt: GenerationAttempt | null) {
  try { if (attempt) storage?.setItem(key(account), JSON.stringify(attempt)); else storage?.removeItem(key(account)); } catch { /* Device storage is optional; server state is authoritative. */ }
}
export function readGenerationAttempt(storage: Pick<Storage, "getItem"> | undefined, account: string, now = Date.now()): GenerationAttempt | null {
  try {
    const raw = storage?.getItem(key(account));
    if (!raw || raw.length > 100_000) return null;
    const a = JSON.parse(raw);
    if (!a || typeof a.id !== "string" || !/^[0-9a-f-]{36}$/i.test(a.id) || !a.payload ||
        typeof a.payload.source !== "string" || JSON.stringify(a.payload) !== a.fingerprint ||
        !Number.isFinite(a.createdAt) || a.createdAt > now || now - a.createdAt >= 45 * 60_000 ||
        (a.stage !== undefined && !/^1:(?:draft|review|correction|revalidation|save):[01]:\d{1,2}$/.test(a.stage))) return null;
    return a;
  } catch { return null; }
}

export async function continueGeneration(attempt: GenerationAttempt, account: string, options: {
  isCurrent: () => boolean; progress: (message: string) => void; checkpoint: (attempt: GenerationAttempt) => void;
  fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>;
}): Promise<GenerationResult> {
  const send = options.fetch ?? fetch;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  // Bounded HTTP continuations, never automatic retry of a rejected/uncertain paid stage.
  for (let step = 0; step < 100; step++) {
    if (!options.isCurrent()) throw new GenerationClientError("Your account changed. No more stages were requested.", "account_changed");
    let response: Response;
    try {
      response = await send("/api/generate", { method: "POST", headers: {
        "Content-Type": "application/json", "X-ContentOS-Account": account,
        ...(attempt.stage ? { "X-ContentOS-Stage": attempt.stage } : {})
      }, body: JSON.stringify({ ...attempt.payload, requestId: attempt.id }) });
    } catch { throw new GenerationClientError("Connection interrupted. Your existing draft is unchanged. Resume this attempt to check saved progress."); }
    if (!options.isCurrent()) throw new GenerationClientError("Your account changed.", "account_changed");
    let data;
    try { data = await response.json(); } catch { throw new GenerationClientError("The response could not be read. Resume this attempt to check saved progress."); }
    if (!response.ok) throw new GenerationClientError(data.error ?? "Generation could not continue.", data.code);
    if (response.status === 202) {
      const p = data as GenerationProgress;
      if (p.status !== "pending" || p.requestId !== attempt.id ||
          !/^1:(?:draft|review|correction|revalidation|save):[01]:\d{1,2}$/.test(p.nextStage) ||
          !Number.isSafeInteger(p.reviewedUnits) || !Number.isSafeInteger(p.totalUnits) ||
          p.reviewedUnits < 0 || p.reviewedUnits > p.totalUnits || p.totalUnits > 500) {
        throw new GenerationClientError("Invalid progress response. Your existing draft is unchanged.");
      }
      attempt.stage = p.nextStage;
      options.checkpoint(attempt);
      options.progress(generationProgressMessage(p));
      if (p.running) await sleep(2000);
      continue;
    }
    if (response.status !== 200 || !Array.isArray(data.sections)) throw new GenerationClientError("Unexpected generation response.");
    return data as GenerationResult;
  }
  throw new GenerationClientError("Work is still pending. Resume this attempt to check saved progress.");
}
