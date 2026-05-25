import { siteConfig } from "@/lib/site";

const signupNotificationRecipient = "nads1983@gmail.com";

export function isValidNotificationEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendSignupNotification(email: string) {
  const cleanedEmail = email.trim().toLowerCase();

  if (!isValidNotificationEmail(cleanedEmail)) {
    throw new Error("A valid signup email is required.");
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const timestamp = new Date().toISOString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "ContentOS <support@getcontentos.co>",
      to: [signupNotificationRecipient],
      subject: "New ContentOS signup",
      text: [
        "New ContentOS signup",
        "",
        `Signed-up email address: ${cleanedEmail}`,
        `Timestamp: ${timestamp}`,
        "App name: ContentOS"
      ].join("\n"),
      html: [
        "<h1>New ContentOS signup</h1>",
        "<ul>",
        `<li><strong>Signed-up email address:</strong> ${cleanedEmail}</li>`,
        `<li><strong>Timestamp:</strong> ${timestamp}</li>`,
        `<li><strong>App name:</strong> ${siteConfig.name}</li>`,
        "</ul>"
      ].join("")
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Resend signup notification failed: ${response.status} ${message}`);
  }

  return { ok: true, timestamp };
}
