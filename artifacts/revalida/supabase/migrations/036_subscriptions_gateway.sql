-- Migration 033: gateway columns for public.subscriptions
-- Adds Asaas integration fields without touching existing rows.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway                  text         NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS gateway_customer_id      text,
  ADD COLUMN IF NOT EXISTS gateway_subscription_id  text,
  ADD COLUMN IF NOT EXISTS next_billing_date         timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at               timestamptz;

COMMENT ON COLUMN public.subscriptions.gateway IS
  'Payment gateway identifier: asaas | stripe | manual';
COMMENT ON COLUMN public.subscriptions.gateway_customer_id IS
  'Customer ID in the gateway (Asaas: cus_xxx)';
COMMENT ON COLUMN public.subscriptions.gateway_subscription_id IS
  'Recurring subscription ID in the gateway (Asaas: sub_xxx)';
COMMENT ON COLUMN public.subscriptions.next_billing_date IS
  'Next billing date as reported by the gateway';
COMMENT ON COLUMN public.subscriptions.canceled_at IS
  'Timestamp when the subscription was canceled / inactivated';
