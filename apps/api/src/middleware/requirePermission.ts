import type { Request, Response, NextFunction } from 'express';

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }
    if (!req.auth.permissions.includes(permission)) {
      return res.status(403).json({ error: { code: 'PERMISSION_DENIED', message: 'You do not have permission to perform this action' } });
    }
    return next();
  };
}
