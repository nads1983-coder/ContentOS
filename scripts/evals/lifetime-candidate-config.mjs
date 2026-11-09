// Evaluation-only: no production route imports this file. Approval required to adopt.
export const limits = Object.freeze({ inputTokens: 8192, outputTokens: 4096, attempts: 2 });
export const rates = Object.freeze({
  'gpt-5.2': { input: 1.75, output: 14, cacheWrite: 1 },
  'gpt-5.6-luna': { input: 0.20, output: 1.20, cacheWrite: 1.25 },
  'gpt-6-luna': { input: 0.10, output: 0.50, cacheWrite: 1.25 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60, cacheWrite: 1 }
});
export function callBound(model, envelope = limits) {
  const r = rates[model];
  if (!r) throw new Error('Unreviewed model');
  // Conservative £1/USD plus 20% contingency, no cache discount.
  return (envelope.inputTokens * r.input * r.cacheWrite + envelope.outputTokens * r.output) / 1e6 * 1.2;
}
export function assertTokenCount(count) {
  if (!Number.isSafeInteger(count) || count <= 0 || count > limits.inputTokens) throw new Error('Input token count unavailable or exceeds evaluation limit');
}
export function packageProjection(model, credits, gross, feeRate = 0.0515, vatRate = 0.20) {
  const api = callBound(model) * limits.attempts * credits;
  const fee = Math.ceil((gross * feeRate + 0.20) * 100) / 100;
  const net = gross / (1 + vatRate);
  // A separate 10% of gross allowance for support/refund/fraud costs, NOT a guarantee.
  const overhead = gross * 0.10;
  return { api, fee, net, overhead, contribution: net - api - fee - overhead,
    margin: (net - api - fee - overhead) / net };
}
