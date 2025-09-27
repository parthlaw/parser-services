-- Add subscriptions_dev table
CREATE TABLE subscriptions_dev (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_type VARCHAR(50) NOT NULL,
    pages_per_period INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    subscription_id VARCHAR(255) NULL , -- external Chargebee id if applicable
    item_price_id VARCHAR(255) NULL , -- external Chargebee id if applicable
    status VARCHAR(50) NOT NULL DEFAULT ''
);

-- Add user_gateway_id_dev table
CREATE TABLE user_gateway_id_dev (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gateway_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, gateway_user_id)
);
-- Add bundles_dev table
CREATE TABLE bundles_dev (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bundle_type VARCHAR(50) NOT NULL,
    pages INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    purchased_at TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ NULL,   -- NULL = lifetime
    invoice_id VARCHAR(255) NULL,
    invoice_line_item_id VARCHAR(255) NULL
);
-- Add page_credits_dev table
CREATE TABLE page_credits_dev (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    change INT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    reference_id UUID NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NULL,
    job_id UUID
);