-- Create UserGatewayId table
CREATE TABLE IF NOT EXISTS user_gateway_id (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, gateway_user_id)
);

-- Create Bundles table
CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_type VARCHAR(50) NOT NULL,
  pages INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  purchased_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ NULL   -- NULL = lifetime
);

-- Create Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_type VARCHAR(50) NOT NULL,
  pages_per_period INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  subscription_id VARCHAR(255) NULL  -- external Chargebee id if applicable
);

-- Create Page Credits Ledger table
CREATE TABLE IF NOT EXISTS page_credits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  change INT NOT NULL,                   -- +pages for grant, -pages for usage
  reason VARCHAR(50) NOT NULL,           -- e.g. PURCHASE, USAGE, REFUND, EXPIRY, ADJUST
  source_type VARCHAR(20) NOT NULL,      -- 'BUNDLE', 'SUBSCRIPTION', 'ADMIN'
  reference_id UUID NULL,              -- points to bundles.id or subscriptions.id
  
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NULL             -- only for positive grants; NULL = lifetime
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_gateway_id_user_id ON user_gateway_id(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gateway_id_gateway_user_id ON user_gateway_id(gateway_user_id);

CREATE INDEX IF NOT EXISTS idx_bundles_user_id ON bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_bundles_bundle_type ON bundles(bundle_type);
CREATE INDEX IF NOT EXISTS idx_bundles_purchased_at ON bundles(purchased_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_type ON subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_start_date ON subscriptions(start_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);

CREATE INDEX IF NOT EXISTS idx_page_credits_user_id ON page_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_page_credits_reason ON page_credits(reason);
CREATE INDEX IF NOT EXISTS idx_page_credits_source_type ON page_credits(source_type);
CREATE INDEX IF NOT EXISTS idx_page_credits_reference_id ON page_credits(reference_id);
CREATE INDEX IF NOT EXISTS idx_page_credits_created_at ON page_credits(created_at);
CREATE INDEX IF NOT EXISTS idx_page_credits_expires_at ON page_credits(expires_at);

-- Add comments for documentation
COMMENT ON TABLE user_gateway_id IS 'Maps internal user IDs to external gateway user IDs';
COMMENT ON TABLE bundles IS 'Stores bundle/purchase information for users';
COMMENT ON TABLE subscriptions IS 'Stores subscription information for users';
COMMENT ON TABLE page_credits IS 'Tracks page credit changes and usage';

COMMENT ON COLUMN bundles.valid_until IS 'Expiration date for bundle, NULL means lifetime';
COMMENT ON COLUMN subscriptions.subscription_id IS 'External subscription ID from payment provider';
COMMENT ON COLUMN page_credits.change IS 'Positive for grants, negative for usage';
COMMENT ON COLUMN page_credits.reason IS 'Reason for the credit change';
COMMENT ON COLUMN page_credits.source_type IS 'Source of the credit change';
COMMENT ON COLUMN page_credits.reference_id IS 'Reference to bundle or subscription that caused this change';
COMMENT ON COLUMN page_credits.expires_at IS 'Expiration date for credits, NULL means lifetime';
