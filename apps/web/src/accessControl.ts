/** Frontend visibility policy only. The API remains the security boundary. */
export type AccessProfile = { permissions?: string[] | null };
export function hasAnyPermission(profile: AccessProfile, required: readonly string[]): boolean {
  if (!required.length) return false;
  const granted = new Set(profile.permissions ?? []);
  return required.some((permission) => granted.has(permission));
}
export function canOpenWorkspace(profile: AccessProfile, required: readonly string[]): boolean {
  return required.length === 0 || hasAnyPermission(profile, required);
}
