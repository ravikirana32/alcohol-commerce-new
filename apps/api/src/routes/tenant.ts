import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';

export const tenantRouter = Router();

tenantRouter.get('/context', authenticate, (req, res) => {
  return res.json({
    data: {
      userId: req.auth!.userId,
      organisationId: req.auth!.organisationId,
      roleCode: req.auth!.roleCode,
      isPlatformAdmin: req.auth!.isPlatformAdmin,
      permissions: req.auth!.permissions
    },
    note: 'Organisation scope is derived from the verified server-issued token, never from a client-supplied organisation header.'
  });
});
