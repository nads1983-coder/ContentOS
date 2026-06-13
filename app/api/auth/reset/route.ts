export const dynamic = "force-dynamic";
export const runtime = "nodejs";

console.log("[PASSWORD-RESET-DIAGNOSTIC] module loaded");

export async function POST() {
  console.log("[PASSWORD-RESET-DIAGNOSTIC] POST handler entered");

  return Response.json({
    success: true,
    diagnostic: "handler_entered"
  });
}
