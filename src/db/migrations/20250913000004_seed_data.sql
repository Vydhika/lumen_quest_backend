-- Migration: Initial Seed Data
-- Created: 2025-09-13T00:00:00.000Z
-- Description: Insert initial data including default plans and admin user setup

-- Up migration
BEGIN;

-- Insert default subscription plans
INSERT INTO plans (id, name, description, price, billing_cycle, features, limits, is_active, trial_days, category, sort_order) VALUES
(
  uuid_generate_v4(),
  'Starter',
  'Perfect for individuals and small projects getting started with our platform.',
  9.99,
  'monthly',
  '[
    "Up to 5 projects",
    "Basic analytics",
    "Email support",
    "Community access",
    "Standard templates"
  ]'::jsonb,
  '{
    "projects": 5,
    "storage_gb": 1,
    "api_calls_per_month": 1000,
    "team_members": 1
  }'::jsonb,
  true,
  14,
  'individual',
  1
),
(
  uuid_generate_v4(),
  'Professional',
  'Ideal for growing businesses and teams that need more features and flexibility.',
  29.99,
  'monthly',
  '[
    "Up to 25 projects",
    "Advanced analytics",
    "Priority email support",
    "Team collaboration",
    "Premium templates",
    "API access",
    "Custom integrations"
  ]'::jsonb,
  '{
    "projects": 25,
    "storage_gb": 10,
    "api_calls_per_month": 10000,
    "team_members": 5
  }'::jsonb,
  true,
  14,
  'business',
  2
),
(
  uuid_generate_v4(),
  'Enterprise',
  'Comprehensive solution for large organizations with advanced needs and dedicated support.',
  99.99,
  'monthly',
  '[
    "Unlimited projects",
    "Enterprise analytics",
    "24/7 phone & email support",
    "Advanced team management",
    "White-label options",
    "Full API access",
    "Custom integrations",
    "Dedicated account manager",
    "SLA guarantees"
  ]'::jsonb,
  '{
    "projects": -1,
    "storage_gb": 100,
    "api_calls_per_month": 100000,
    "team_members": -1
  }'::jsonb,
  true,
  30,
  'enterprise',
  3
);

-- Insert yearly variants with discounts
INSERT INTO plans (id, name, description, price, billing_cycle, features, limits, is_active, trial_days, category, sort_order) VALUES
(
  uuid_generate_v4(),
  'Starter Annual',
  'Perfect for individuals and small projects - save 20% with annual billing.',
  95.90,
  'yearly',
  '[
    "Up to 5 projects",
    "Basic analytics",
    "Email support",
    "Community access",
    "Standard templates",
    "20% savings vs monthly"
  ]'::jsonb,
  '{
    "projects": 5,
    "storage_gb": 1,
    "api_calls_per_month": 1000,
    "team_members": 1
  }'::jsonb,
  true,
  14,
  'individual',
  4
),
(
  uuid_generate_v4(),
  'Professional Annual',
  'Ideal for growing businesses - save 20% with annual billing.',
  287.90,
  'yearly',
  '[
    "Up to 25 projects",
    "Advanced analytics",
    "Priority email support",
    "Team collaboration",
    "Premium templates",
    "API access",
    "Custom integrations",
    "20% savings vs monthly"
  ]'::jsonb,
  '{
    "projects": 25,
    "storage_gb": 10,
    "api_calls_per_month": 10000,
    "team_members": 5
  }'::jsonb,
  true,
  14,
  'business',
  5
),
(
  uuid_generate_v4(),
  'Enterprise Annual',
  'Comprehensive enterprise solution - save 20% with annual billing.',
  959.90,
  'yearly',
  '[
    "Unlimited projects",
    "Enterprise analytics",
    "24/7 phone & email support",
    "Advanced team management",
    "White-label options",
    "Full API access",
    "Custom integrations",
    "Dedicated account manager",
    "SLA guarantees",
    "20% savings vs monthly"
  ]'::jsonb,
  '{
    "projects": -1,
    "storage_gb": 100,
    "api_calls_per_month": 100000,
    "team_members": -1
  }'::jsonb,
  true,
  30,
  'enterprise',
  6
);

-- Insert a special free plan
INSERT INTO plans (id, name, description, price, billing_cycle, features, limits, is_active, trial_days, category, sort_order) VALUES
(
  uuid_generate_v4(),
  'Free',
  'Get started with our platform at no cost. Perfect for testing and small personal projects.',
  0.00,
  'monthly',
  '[
    "1 project",
    "Basic features",
    "Community support",
    "Standard templates"
  ]'::jsonb,
  '{
    "projects": 1,
    "storage_gb": 0.1,
    "api_calls_per_month": 100,
    "team_members": 1
  }'::jsonb,
  true,
  0,
  'free',
  0
);

-- Create initial admin user profile (this will be linked when the first admin signs up)
-- Note: The actual user will be created in Supabase Auth, this is just the profile template
INSERT INTO profiles (user_id, email, full_name, role, is_active, preferences, created_at, updated_at) VALUES
(
  '00000000-0000-0000-0000-000000000001', -- Placeholder UUID for system admin
  'admin@lumenquest.com',
  'System Administrator',
  'admin',
  true,
  '{
    "email_notifications": true,
    "sms_notifications": false,
    "marketing_emails": false,
    "language": "en",
    "timezone": "UTC"
  }'::jsonb,
  NOW(),
  NOW()
);

-- Insert some notification templates (to be used by the notification service)
INSERT INTO notifications (id, user_id, type, channel, subject, message, data, status, created_at) VALUES
(
  uuid_generate_v4(),
  NULL, -- Template, not for specific user
  'welcome',
  'email',
  'Welcome to Lumen Quest!',
  'Thank you for joining Lumen Quest. Your subscription to {{plan_name}} is now active. Get started by exploring our features and setting up your first project.',
  '{
    "template": true,
    "variables": ["plan_name", "user_name"]
  }'::jsonb,
  'sent', -- Mark as sent so it doesn't get processed
  NOW()
),
(
  uuid_generate_v4(),
  NULL,
  'subscription_cancelled',
  'email',
  'Subscription Cancelled',
  'Your subscription to {{plan_name}} has been cancelled. Your access will continue until {{end_date}}. We''re sorry to see you go!',
  '{
    "template": true,
    "variables": ["plan_name", "end_date", "user_name"]
  }'::jsonb,
  'sent',
  NOW()
),
(
  uuid_generate_v4(),
  NULL,
  'payment_failed',
  'email',
  'Payment Failed - Action Required',
  'We were unable to process your payment for {{plan_name}}. Please update your payment method to continue your subscription.',
  '{
    "template": true,
    "variables": ["plan_name", "amount", "user_name"]
  }'::jsonb,
  'sent',
  NOW()
),
(
  uuid_generate_v4(),
  NULL,
  'trial_ending',
  'email',
  'Your Trial is Ending Soon',
  'Your {{trial_days}}-day trial of {{plan_name}} ends in {{days_remaining}} days. Subscribe now to continue enjoying all features.',
  '{
    "template": true,
    "variables": ["plan_name", "trial_days", "days_remaining", "user_name"]
  }'::jsonb,
  'sent',
  NOW()
);

-- Create some sample audit log entries for testing
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, metadata) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'INSERT_plans',
  'plans',
  (SELECT id FROM plans WHERE name = 'Starter' LIMIT 1),
  NULL,
  '{"action": "seed_data_creation"}'::jsonb,
  '{"source": "initial_migration", "automated": true}'::jsonb
);

-- Insert configuration/settings (using a simple key-value approach in plans metadata)
INSERT INTO plans (id, name, description, price, billing_cycle, features, limits, is_active, category, metadata) VALUES
(
  uuid_generate_v4(),
  'SYSTEM_CONFIG',
  'System configuration settings',
  0,
  'monthly',
  '[]'::jsonb,
  '{}'::jsonb,
  false,
  'system',
  '{
    "config": {
      "tax_rate": 0.08,
      "currency": "USD",
      "trial_grace_period_days": 3,
      "payment_retry_attempts": 3,
      "notification_retry_attempts": 3,
      "session_timeout_minutes": 60,
      "password_min_length": 8,
      "max_projects_free": 1,
      "support_email": "support@lumenquest.com",
      "company_name": "Lumen Quest",
      "company_address": "123 Innovation Drive, Tech City, TC 12345"
    }
  }'::jsonb
);

COMMIT;