-- Existing databases: add agent as a contract signatory alongside owner and tenant.
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS agent_signed_at TIMESTAMPTZ NULL;
