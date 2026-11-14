-- P61: Trade partner engagement
-- Validate in staging before applying to production.
CREATE TABLE IF NOT EXISTS trade_reward_catalogue (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL, reward_code TEXT NOT NULL, title TEXT NOT NULL, points_cost INTEGER NOT NULL CHECK(points_cost > 0), active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(organisation_id,reward_code));
