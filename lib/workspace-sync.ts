import type { WorkspaceWriteInput } from "./workspace-contract";

type State = Omit<WorkspaceWriteInput, "revision">;
type Save = (input: WorkspaceWriteInput) => Promise<{ revision: number }>;

// One writer per tab. Server-side revision checks arbitrate other tabs/devices.
export function createWorkspaceWriter(revision: number, save: Save, report: (message: string) => void) {
  let pending: State | undefined;
  let running = false;
  let blocked = false;
  let failureMessage = "";
  let disposed = false;
  async function flush() {
    if (disposed) return;
    if (blocked) { report(failureMessage); return; }
    if (running || !pending) return;
    running = true;
    try {
      while (pending && !disposed) {
        const next = pending;
        pending = undefined;
        report("Saving to your account...");
        try {
          const result = await save({ ...next, revision });
          if (disposed) return;
          revision = result.revision;
        } catch (error) {
          if (disposed) return;
          // Keep the most recent edit, never replay an older snapshot over it.
          pending ??= next;
          blocked = true;
          failureMessage = error instanceof Error ? error.message : "Account save failed. Your local copy is retained.";
          report(failureMessage);
          return;
        }
      }
      if (!disposed) report("Saved to your account");
    } finally { running = false; }
  }
  return {
    enqueue(state: State) { if (disposed) return Promise.resolve(); pending = state; return flush(); },
    dispose() { disposed = true; pending = undefined; },
    // A conflict needs a fresh read and review, not a blind retry with a newer revision.
    retry() { if (blocked) return; return flush(); }
  };
}
