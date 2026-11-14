import { Router } from 'express';

export const platformRouter = Router();

// Product modes are configuration profiles only.
// They do not grant legal permission to perform any regulated activity.
platformRouter.get('/operating-modes', (_req, res) => {
  res.json({
    data: [
      { code: 'RETAIL_ONLY', label: 'Retail-only', capabilities: ['PACKAGED_SALES'] },
      { code: 'BAR_ONLY', label: 'Bar-only', capabilities: ['ON_PREMISE_PEG_SALES'] },
      { code: 'HYBRID', label: 'Hybrid', capabilities: ['PACKAGED_SALES', 'ON_PREMISE_PEG_SALES'] }
    ],
    note: 'Actual capabilities must be validated against the outlet licence profile.'
  });
});
