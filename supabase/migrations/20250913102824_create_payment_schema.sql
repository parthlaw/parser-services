-- Create payment gateway enum
CREATE TYPE payment_gateway AS ENUM ('razorpay', 'paypal');

-- Create Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gateway_plan_id VARCHAR NOT NULL,
    gateway_subscription_id VARCHAR NOT NULL,
    gateway payment_gateway NOT NULL,
    status string NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gateway_order_id VARCHAR NOT NULL,
    gateway payment_gateway NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status string NOT NULL DEFAULT 'created',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    gateway_payment_id VARCHAR NOT NULL,
    gateway payment_gateway NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status string NOT NULL DEFAULT 'pending',
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure payment is linked to either order or subscription, but not both
    CONSTRAINT payment_link_check CHECK (
        (order_id IS NOT NULL AND subscription_id IS NULL) OR
        (order_id IS NULL AND subscription_id IS NOT NULL)
    )
);

-- Create Refunds table
CREATE TABLE refunds (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    gateway_refund_id VARCHAR NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    status string NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_gateway_subscription_id ON subscriptions(gateway_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_gateway_order_id ON orders(gateway_order_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_gateway_payment_id ON payments(gateway_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_gateway_refund_id ON refunds(gateway_refund_id);

-- Enable Row Level Security (RLS)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o WHERE o.id = payments.order_id AND auth.uid() = o.user_id
        ) OR
        EXISTS (
            SELECT 1 FROM subscriptions s WHERE s.id = payments.subscription_id AND auth.uid() = s.user_id
        )
    );

CREATE POLICY "Users can view own refunds" ON refunds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM payments p 
            JOIN orders o ON p.order_id = o.id 
            WHERE p.id = refunds.payment_id AND auth.uid() = o.user_id
        ) OR
        EXISTS (
            SELECT 1 FROM payments p 
            JOIN subscriptions s ON p.subscription_id = s.id 
            WHERE p.id = refunds.payment_id AND auth.uid() = s.user_id
        )
    );

-- Add comments for documentation
COMMENT ON TABLE subscriptions IS 'Recurring subscription payments';
COMMENT ON TABLE orders IS 'One-time payment orders';
COMMENT ON TABLE payments IS 'Payment records linked to either orders or subscriptions';
COMMENT ON TABLE refunds IS 'Refund records for payments';

COMMENT ON COLUMN subscriptions.gateway_plan_id IS 'Plan ID from payment gateway (Razorpay/PayPal)';
COMMENT ON COLUMN subscriptions.gateway_subscription_id IS 'Subscription ID from payment gateway';
COMMENT ON COLUMN orders.gateway_order_id IS 'Order ID from payment gateway';
COMMENT ON COLUMN payments.gateway_payment_id IS 'Payment ID from payment gateway';
COMMENT ON COLUMN refunds.gateway_refund_id IS 'Refund ID from payment gateway';
