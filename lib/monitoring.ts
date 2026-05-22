export function captureServerError(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : "Unknown error";

  console.error("[ContentOS]", message, context);
}

export function analyticsEvent(name: string, properties: Record<string, unknown> = {}) {
  console.info("[ContentOS analytics]", name, properties);
}
