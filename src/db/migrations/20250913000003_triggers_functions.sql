-- Migration: Database Triggers and Functions
-- Created: 2025-09-13T00:00:00.000Z
-- Description: Create triggers for updated_at timestamps, audit logging, and business logic automation

-- Up migration
BEGIN;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers for all tables
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_month TEXT;
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYYYMM');
  
  -- Get next sequence number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_month || '%';
  
  invoice_num := 'INV-' || year_month || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoices_auto_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice_number();

-- Function to log audit trail
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  audit_action TEXT;
  old_values JSONB;
  new_values JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    audit_action := 'INSERT';
    old_values := NULL;
    new_values := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'UPDATE' THEN
    audit_action := 'UPDATE';
    old_values := row_to_json(OLD)::JSONB;
    new_values := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    audit_action := 'DELETE';
    old_values := row_to_json(OLD)::JSONB;
    new_values := NULL;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    audit_action || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    old_values,
    new_values
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
CREATE TRIGGER audit_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_plans
  AFTER INSERT OR UPDATE OR DELETE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Function to handle subscription status changes
CREATE OR REPLACE FUNCTION handle_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription is being cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := NOW();
    NEW.auto_renewal := false;
  END IF;

  -- If subscription is being paused
  IF NEW.status = 'paused' AND OLD.status != 'paused' THEN
    NEW.paused_at := NOW();
  END IF;

  -- If subscription is being reactivated from cancelled/paused
  IF NEW.status = 'active' AND OLD.status IN ('cancelled', 'paused') THEN
    NEW.cancelled_at := NULL;
    NEW.paused_at := NULL;
    NEW.pause_duration_days := NULL;
  END IF;

  -- Update next billing date when status changes to active
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    -- Calculate next billing date based on billing cycle
    CASE NEW.billing_cycle
      WHEN 'monthly' THEN
        NEW.next_billing_date := NEW.current_period_end + INTERVAL '1 month';
      WHEN 'yearly' THEN
        NEW.next_billing_date := NEW.current_period_end + INTERVAL '1 year';
      WHEN 'quarterly' THEN
        NEW.next_billing_date := NEW.current_period_end + INTERVAL '3 months';
      WHEN 'weekly' THEN
        NEW.next_billing_date := NEW.current_period_end + INTERVAL '1 week';
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscription_status_change
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_subscription_status_change();

-- Function to ensure only one default payment method per user
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this payment method as default
  IF NEW.is_default = true THEN
    -- Set all other payment methods for this user to non-default
    UPDATE payment_methods 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_payment_method
  BEFORE INSERT OR UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- Function to calculate subscription period end
CREATE OR REPLACE FUNCTION calculate_subscription_period_end(
  start_date TIMESTAMP WITH TIME ZONE,
  billing_cycle VARCHAR(50)
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  CASE billing_cycle
    WHEN 'monthly' THEN
      RETURN start_date + INTERVAL '1 month';
    WHEN 'yearly' THEN
      RETURN start_date + INTERVAL '1 year';
    WHEN 'quarterly' THEN
      RETURN start_date + INTERVAL '3 months';
    WHEN 'weekly' THEN
      RETURN start_date + INTERVAL '1 week';
    ELSE
      RAISE EXCEPTION 'Invalid billing cycle: %', billing_cycle;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to set subscription period dates
CREATE OR REPLACE FUNCTION set_subscription_period_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set current period end if not provided
  IF NEW.current_period_end IS NULL THEN
    NEW.current_period_end := calculate_subscription_period_end(
      NEW.current_period_start,
      NEW.billing_cycle
    );
  END IF;

  -- Set next billing date if subscription is active
  IF NEW.status = 'active' AND NEW.next_billing_date IS NULL THEN
    NEW.next_billing_date := NEW.current_period_end;
  END IF;

  -- Handle trial period
  IF NEW.trial_start IS NOT NULL AND NEW.trial_end IS NULL THEN
    SELECT trial_days INTO NEW.trial_end
    FROM plans
    WHERE id = NEW.plan_id;
    
    IF NEW.trial_end > 0 THEN
      NEW.trial_end := NEW.trial_start + (NEW.trial_end || ' days')::INTERVAL;
      NEW.status := 'trial';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscription_period_dates
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_subscription_period_dates();

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total from subtotal, tax, and discount
  NEW.total_amount := NEW.subtotal + NEW.tax_amount - NEW.discount_amount;
  
  -- Ensure total is not negative
  IF NEW.total_amount < 0 THEN
    NEW.total_amount := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_totals
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_totals();

-- Function to update invoice status when payment is made
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment succeeded and invoice exists
  IF NEW.status = 'succeeded' AND NEW.invoice_id IS NOT NULL THEN
    UPDATE invoices 
    SET 
      status = 'paid',
      paid_at = NEW.processed_at
    WHERE id = NEW.invoice_id;
  END IF;

  -- If payment failed
  IF NEW.status = 'failed' AND NEW.invoice_id IS NOT NULL THEN
    UPDATE invoices 
    SET status = 'failed'
    WHERE id = NEW.invoice_id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_on_payment
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_payment();

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Delete notifications older than 30 days that were successfully sent
  DELETE FROM notifications 
  WHERE status = 'sent' 
    AND sent_at < NOW() - INTERVAL '30 days';

  -- Delete failed notifications older than 7 days
  DELETE FROM notifications 
  WHERE status = 'failed' 
    AND failed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMIT;