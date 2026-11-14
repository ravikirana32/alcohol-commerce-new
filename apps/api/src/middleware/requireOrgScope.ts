import type { Request, Response, NextFunction } from 'express';
export function requireOrgScope(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
  if (!req.auth.isPlatformAdmin && !req.auth.organisationId) {
    return res.status(403).json({ error: { code: 'ORG_CONTEXT_REQUIRED' } });
  }
  const requested = req.params.organisationId;
  if (requested && !req.auth.isPlatformAdmin && requested !== req.auth.organisationId) {
    return res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND' } });
  }
  return next();
}
