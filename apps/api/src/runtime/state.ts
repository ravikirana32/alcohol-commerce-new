/**
 * Process-local readiness state. This is intentionally not persisted.
 * A new process starts accepting traffic only after startup validation succeeds.
 */
let draining = false;

export function beginDrain(): void {
  draining = true;
}

export function isDraining(): boolean {
  return draining;
}
