// Registration delivers a deduplicated notification internally.
export function POST() { return Response.json({ error: "Notifications are handled during account registration." }, { status: 410 }); }
