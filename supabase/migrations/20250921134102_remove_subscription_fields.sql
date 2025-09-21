-- Remove fields from subscriptions table
-- Drop related indexes first
DROP INDEX IF EXISTS idx_subscriptions_subscription_type;

-- Remove columns from subscriptions table
ALTER TABLE subscriptions 
DROP COLUMN IF EXISTS pages_per_period,
DROP COLUMN IF EXISTS price,
DROP COLUMN IF EXISTS subscription_type;
