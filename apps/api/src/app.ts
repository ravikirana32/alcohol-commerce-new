import express from 'express';
import { normaliseCorrelationId } from './services/correlationId.js';
import { isDraining } from './runtime/state.js';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';
import { platformRouter } from './routes/platform.js';
import { authRouter } from './routes/auth.js';
import { tenantRouter } from './routes/tenant.js';
import { operationsRouter } from './routes/operations.js';
import { ecosystemRouter } from './routes/ecosystem.js';
import { capabilitiesRouter } from './routes/capabilities.js';
import { barCheckoutRouter } from './routes/barCheckout.js';
import { barMenuRouter } from './routes/barMenu.js';
import { settlementsRouter } from './routes/settlements.js';
import { procurementRouter } from './routes/procurement.js';
import { paymentReconciliationRouter } from './routes/paymentReconciliation.js';
import { paymentLifecycleRouter } from './routes/paymentLifecycle.js';
import { razorpayTabPaymentsRouter } from './routes/razorpayTabPayments.js';
import { financeRouter } from './routes/finance.js';
import { financeAutomationRouter } from './routes/financeAutomation.js';
import { analyticsRouter } from './routes/analytics.js';
import { tradePortalRouter } from './routes/tradePortal.js';
import { devicesRouter } from './routes/devices.js';
import { enterpriseIntegrationsRouter } from './routes/enterpriseIntegrations.js';
import { securityAuditRouter } from './routes/securityAudit.js';
import { securityRateLimit } from './middleware/securityRateLimit.js';
import { offlineSyncRouter } from './routes/offlineSync.js';
import { offlineReconciliationRouter } from './routes/offlineReconciliation.js';
import { offlineValidationRouter } from './routes/offlineValidation.js';
import { offlineAuthoritativeRouter } from './routes/offlineAuthoritative.js';
import { offlinePostingApprovalRouter } from './routes/offlinePostingApproval.js';
import { offlineLedgerPostingRouter } from './routes/offlineLedgerPosting.js';
import { offlineRecoveryRouter } from './routes/offlineRecovery.js';
import { exciseComplianceRouter } from './routes/exciseCompliance.js';
import { taxPricingRouter } from './routes/taxPricing.js';
import { regulatoryReportsRouter } from './routes/regulatoryReports.js';
import { deviceOperationsRouter } from './routes/deviceOperations.js';
import { reportGovernanceRouter } from './routes/reportGovernance.js';
import { organisationAccessRouter, invitationAcceptanceRouter } from './routes/organisationAccess.js';
import { catalogueRouter } from './routes/catalogue.js';
import { APP_VERSION } from './config/version.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? ['http://localhost:5173'] }));

// Correlate every request without trusting arbitrary unbounded client input.
app.use((req, res, next) => {
  try {
    const requestId = normaliseCorrelationId(req.header('x-request-id'));
    res.setHeader('X-Request-Id', requestId);
    res.locals.requestId = requestId;
    if (isDraining() && req.path !== '/api/health/live') {
      res.status(503).json({
        error: { code: 'SERVICE_DRAINING', message: 'Service is shutting down; retry against another instance.' },
        requestId
      });
      return;
    }
    next();
  } catch {
    res.status(400).json({ error: { code: 'INVALID_REQUEST_ID', message: 'The X-Request-Id header is invalid.' } });
  }
});

// Preserve exact provider bytes for HMAC verification before the general JSON parser.
app.use('/api/v1/payments/provider-webhooks', express.raw({ type: 'application/json', limit: '1mb' }));

// Parse request bodies only after the request ID middleware so parser errors
// are returned with the same correlation identifier as all other responses.
app.use(express.json({ limit: '1mb' }));
app.use(securityRateLimit);

app.get('/', (_req, res) => {
  res.json({ name: 'Alcohol Commerce Platform API', version: APP_VERSION });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    name: 'Alcohol Commerce Platform API',
    version: APP_VERSION,
    environment: process.env.NODE_ENV ?? 'development',
    featureFlags: {
      ai: process.env.AI_FEATURES_ENABLED === 'true',
      offlineSync: process.env.OFFLINE_SYNC_ENABLED === 'true',
      consumerDiscovery: process.env.CONSUMER_DISCOVERY_ENABLED === 'true',
      livePayments: process.env.PAYMENT_LIVE_MODE === 'true'
    }
  });
});

app.use('/api/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tenant', tenantRouter);
app.use('/api/v1', invitationAcceptanceRouter);
app.use('/api/v1', organisationAccessRouter);
app.use('/api/v1', catalogueRouter);
app.use('/api/v1/platform', platformRouter);
app.use('/api/v1', operationsRouter);
app.use('/api/v1', ecosystemRouter);
app.use('/api/v1', capabilitiesRouter);
app.use('/api/v1', barCheckoutRouter);
app.use('/api/v1', barMenuRouter);
app.use('/api/v1', settlementsRouter);
app.use('/api/v1', procurementRouter);
app.use('/api/v1', paymentReconciliationRouter);
app.use('/api/v1', paymentLifecycleRouter);
app.use('/api/v1', razorpayTabPaymentsRouter);
app.use('/api/v1', financeRouter);
app.use('/api/v1', financeAutomationRouter);
app.use('/api/v1', analyticsRouter);
app.use('/api/v1', tradePortalRouter);
app.use('/api/v1', devicesRouter);
app.use('/api/v1', enterpriseIntegrationsRouter);
app.use('/api/v1', securityAuditRouter);
app.use('/api/v1', offlineSyncRouter);
app.use('/api/v1', offlineReconciliationRouter);
app.use('/api/v1', offlineValidationRouter);
app.use('/api/v1', offlineAuthoritativeRouter);
app.use('/api/v1', offlinePostingApprovalRouter);
app.use('/api/v1', offlineLedgerPostingRouter);
app.use('/api/v1', offlineRecoveryRouter);
app.use('/api/v1', exciseComplianceRouter);
app.use('/api/v1', taxPricingRouter);
app.use('/api/v1', regulatoryReportsRouter);
app.use('/api/v1', deviceOperationsRouter);
app.use('/api/v1', reportGovernanceRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
    requestId: res.locals.requestId
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const candidate = err as { status?: number; statusCode?: number; type?: string };
  const status = candidate?.statusCode ?? candidate?.status ?? 500;
  const isClientError = Number.isInteger(status) && status >= 400 && status < 500;
  const code = candidate?.type === 'entity.parse.failed'
    ? 'INVALID_JSON'
    : candidate?.type === 'entity.too.large'
      ? 'PAYLOAD_TOO_LARGE'
      : isClientError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
  const message = code === 'INVALID_JSON' ? 'Request body must contain valid JSON.'
    : code === 'PAYLOAD_TOO_LARGE' ? 'Request body exceeds the 1 MB limit.'
      : isClientError ? 'The request could not be processed.' : 'An unexpected server error occurred.';
  if (!isClientError) {
    console.error('[api-error]', { error: err instanceof Error ? err.message : 'unknown', requestId: res.locals.requestId });
  }
  res.status(isClientError ? status : 500).json({
    error: { code, message },
    requestId: res.locals.requestId
  });
});
