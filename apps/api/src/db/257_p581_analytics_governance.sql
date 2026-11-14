-- P581: governed reporting, saved definitions and immutable execution evidence.
CREATE TABLE IF NOT EXISTS p581_saved_reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
 report_code TEXT NOT NULL CHECK(report_code IN ('SALES_OVERVIEW','SALES_TREND','TOP_PRODUCTS','INVENTORY_MOVEMENTS','FINANCE_PNL')),
 definition JSONB NOT NULL DEFAULT '{}'::jsonb,
 schedule_cron TEXT, timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','ARCHIVED')),
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,name)
);
CREATE TABLE IF NOT EXISTS p581_report_execution_evidence (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 saved_report_id UUID REFERENCES p581_saved_reports(id) ON DELETE RESTRICT,
 report_code TEXT NOT NULL, period_from DATE NOT NULL, period_to DATE NOT NULL CHECK(period_to>=period_from),
 requested_by UUID NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('SUCCEEDED','FAILED')),
 row_count INTEGER NOT NULL DEFAULT 0 CHECK(row_count>=0), totals JSONB NOT NULL DEFAULT '{}'::jsonb,
 result_hash CHAR(64) NOT NULL, error_code TEXT, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p581_report_exec_org_date ON p581_report_execution_evidence(organisation_id,executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_p581_saved_reports_schedule ON p581_saved_reports(status,schedule_cron) WHERE schedule_cron IS NOT NULL;
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('PLATFORM_ADMIN','reports:governance:manage'),('RETAIL_OWNER','reports:governance:manage'),('BAR_OWNER','reports:governance:manage'),
 ('RETAIL_MANAGER','reports:governance:manage'),('BAR_MANAGER','reports:governance:manage'),
 ('AUDITOR','reports:governance:read'),('PLATFORM_ADMIN','reports:governance:read'),('RETAIL_OWNER','reports:governance:read'),('BAR_OWNER','reports:governance:read')
ON CONFLICT DO NOTHING;
