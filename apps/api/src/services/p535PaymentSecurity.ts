import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
export function verifyProviderWebhook(raw: Buffer, signature: string | undefined, secret: string | undefined): boolean {
  if (!raw?.length || !signature || !secret) return false;
  const supplied = signature.replace(/^sha256=/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const hashWebhookPayload = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');
export function providerSecretName(provider: string): string | null {
  const safe = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return /^[A-Z][A-Z0-9_]{1,39}$/.test(safe) ? `PAYMENT_WEBHOOK_SECRET_${safe}` : null;
}
