export type SessionPolicy = { tokenLifetimeSeconds: number; sessionLifetimeSeconds: number };
export function resolveSessionPolicy(env: NodeJS.ProcessEnv = process.env): SessionPolicy {
  const raw = Number(env.AUTH_SESSION_TTL_SECONDS ?? 8 * 60 * 60);
  if (!Number.isSafeInteger(raw) || raw < 300 || raw > 24 * 60 * 60) throw new Error('AUTH_SESSION_TTL_SECONDS must be an integer between 300 and 86400');
  return { tokenLifetimeSeconds: raw, sessionLifetimeSeconds: raw };
}
