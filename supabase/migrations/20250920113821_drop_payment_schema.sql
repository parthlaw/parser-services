-- Drop payment schema tables and related objects
-- This migration drops all tables, indexes, policies, and types created in 20250913102824_create_payment_schema.sql

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view own refunds" ON refunds;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS subscriptions;

-- Drop the payment_gateway enum type
DROP TYPE IF EXISTS payment_gateway;