import { Router } from 'express';
import { phaseCapabilities } from '../capabilities/phaseRegistry.js';
export const capabilitiesRouter = Router();
capabilitiesRouter.get('/capabilities/phases', (_req, res) => {
  res.json({ data: phaseCapabilities, disclaimer: 'Phase registry metadata only; not evidence of production readiness.' });
});
