import React, { createContext, useContext } from 'react';
import { canPerformAction, type ActionKey } from './actionPermissions';

const PermissionContext = createContext<string[]>([]);
export function PermissionProvider({ permissions, children }: { permissions: string[]; children: React.ReactNode }) {
  return <PermissionContext.Provider value={permissions}>{children}</PermissionContext.Provider>;
}
export function useActionPermission(action: ActionKey): boolean {
  return canPerformAction({ permissions: useContext(PermissionContext) }, action);
}
export function ActionGuard({ action, children, fallback = null }: { action: ActionKey; children: React.ReactNode; fallback?: React.ReactNode }) {
  return useActionPermission(action) ? <>{children}</> : <>{fallback}</>;
}
