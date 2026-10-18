import type { WorkspaceWriteInput } from "./workspace-contract";

type State = Omit<WorkspaceWriteInput, "revision">;
type Save = (input: WorkspaceWriteInput) => Promise<{ revision: number }>;

// One writer per tab. Server-side revision checks arbitrate other tabs/devices.
export function createWorkspaceWriter(revision: number, save: Save, report: (message: string) => void) {
  let pending: State | undefined;
  let running = false;
  let blocked = false;
  let failureMessage = "";
  async function flush() {
    if (blocked) { report(failureMessage); return; }
    if (running || !pending) return;
    running = true;
    try {
      while (pending) {
        const next = pending;
        pending = undefined;
        report("Saving to your account...");
        try {
          const result = await save({ ...next, revision });
          revision = result.revision;
        } catch (error) {
          // Keep the most recent edit, never replay an older snapshot over it.
          pending ??= next;
          blocked = true;
          failureMessage = error instanceof Error ? error.message : "Account save failed. Your local copy is retained.";
          report(failureMessage);
          return;
        }
      }
      report("Saved to your account");
    } finally { running = false; }
  }
  return {
    enqueue(state: State) { pending = state; return flush(); },
    // A conflict needs a fresh read and review, not a blind retry with a newer revision.
    retry() { if (blocked) return; return flush(); }
  };
}
