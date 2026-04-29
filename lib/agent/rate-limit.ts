const WINDOW_MS = 60_000;
const LIMIT = 60;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkAgentRateLimit(tokenKey: string, now = Date.now()) {
  const current = buckets.get(tokenKey);
  if (!current || current.resetAt <= now) {
    buckets.set(tokenKey, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: LIMIT - 1, resetAt: now + WINDOW_MS };
  }

  if (current.count >= LIMIT) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { ok: true, remaining: LIMIT - current.count, resetAt: current.resetAt };
}
