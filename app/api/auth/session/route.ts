// Retire legacy client-supplied session tokens; sessions are created only by verified login.
export function POST() { return Response.json({ error: "Sign in to create a session." }, { status: 410 }); }
