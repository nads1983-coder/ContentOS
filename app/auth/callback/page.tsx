import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
// Old callback links cannot create a session. Email verification is handled server-side.
export default function AuthCallbackPage() { redirect("/login"); }
