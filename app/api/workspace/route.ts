import { getCurrentUser } from "@/lib/auth";
import { getWorkspace, saveWorkspace } from "@/lib/postgres-repository";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { MAX_WORKSPACE_BYTES, parseWorkspaceWrite, WorkspaceError } from "@/lib/workspace-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
function failure(error: unknown) {
  if (error instanceof WorkspaceError) return json({ error: error.message, code: error.code, ...(error.revision !== undefined ? { revision: error.revision } : {}) }, error.status);
  console.error("[workspace] persistence unavailable");
  return json({ error: "Workspace could not be loaded or saved. Please retry later." }, 503);
}
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Login required." }, 401);
    return json(await getWorkspace(user.id));
  } catch (error) { return failure(error); }
}
async function readInput(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_WORKSPACE_BYTES) throw new WorkspaceError("Workspace is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError("Invalid request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_WORKSPACE_BYTES) {
        await reader.cancel();
        throw new WorkspaceError("Workspace is too large.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return parseWorkspaceWrite(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
  catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError("Invalid request JSON.");
  }
}
export async function PUT(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Login required." }, 401);
    const input = await readInput(request);
    return json(await saveWorkspace(user.id, input));
  } catch (error) { return failure(error); }
}
