-- INSERT policies
CREATE POLICY "Users can create own subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can create payments for own orders/subscriptions" ON payments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o WHERE o.id = payments.order_id AND auth.uid() = o.user_id
        ) OR
        EXISTS (
            SELECT 1 FROM subscriptions s WHERE s.id = payments.subscription_id AND auth.uid() = s.user_id
        )
    );

CREATE POLICY "Users can create refunds for own payments" ON refunds
    FOR INSERT WITH CHECK (
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

-- UPDATE policies
CREATE POLICY "Users can update own subscriptions" ON subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON orders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own payments" ON payments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders o WHERE o.id = payments.order_id AND auth.uid() = o.user_id
        ) OR
        EXISTS (
            SELECT 1 FROM subscriptions s WHERE s.id = payments.subscription_id AND auth.uid() = s.user_id
        )
    );

CREATE POLICY "Users can update own refunds" ON refunds
    FOR UPDATE USING (
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
