ALTER TABLE agent_invoices
  ADD COLUMN IF NOT EXISTS payment_slip_path TEXT;
