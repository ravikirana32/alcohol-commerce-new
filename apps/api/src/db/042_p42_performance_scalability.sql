-- P42: Performance & scalability
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS performance_benchmarks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), scenario_key TEXT NOT NULL, environment TEXT NOT NULL, p50_ms NUMERIC(12,2), p95_ms NUMERIC(12,2), p99_ms NUMERIC(12,2), throughput NUMERIC(14,2), recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
