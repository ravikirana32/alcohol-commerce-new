// P454: Request correlation identifier policy
import { randomUUID } from 'node:crypto';

export const normaliseCorrelationId = (value: string | undefined): string => {
  if (!value) return `req-${randomUUID()}`;
  const candidate = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/.test(candidate)) {
    throw new Error('Invalid correlation id');
  }
  return candidate;
};
