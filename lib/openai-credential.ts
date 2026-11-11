// Production must use its independently provisioned credential. Other
// environments retain the existing binding and never fall back in Production.
export function openAIKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.VERCEL_ENV === "production" ? env.OPENAI_API_KEY_1 : env.OPENAI_API_KEY;
  return key?.trim() || undefined;
}
