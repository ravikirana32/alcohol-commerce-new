export type RecoveryStatus = 'OPEN'|'TRIAGED'|'RETRY_REQUIRED'|'CANCELLED'|'COMPENSATION_PENDING'|'COMPENSATION_APPROVED'|'COMPENSATION_REJECTED'|'RESOLVED';
export type ExecutionOutcome = 'POSTED'|'BLOCKED';

export function canTriage(status: RecoveryStatus): boolean { return status === 'OPEN' || status === 'TRIAGED'; }
export function canRequestRetry(status: RecoveryStatus, outcome: ExecutionOutcome): boolean { return status === 'TRIAGED' && outcome === 'BLOCKED'; }
export function canCancelRecovery(status: RecoveryStatus, outcome: ExecutionOutcome, intentStatus: string): boolean {
  return outcome === 'BLOCKED' && ['OPEN','TRIAGED','RETRY_REQUIRED'].includes(status) && ['HELD','AUTHORIZED_TO_POST'].includes(intentStatus);
}
export function canRequestCompensation(status: RecoveryStatus, outcome: ExecutionOutcome): boolean {
  return outcome === 'POSTED' && (status === 'OPEN' || status === 'TRIAGED');
}
export function canDecideCompensation(status: RecoveryStatus, requesterId: string | null, actorId: string): boolean {
  return status === 'COMPENSATION_PENDING' && !!requesterId && requesterId !== actorId;
}
