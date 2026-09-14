-- Run within a transaction using the configured DB_SCHEMA search_path.
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS agent_signed_at TIMESTAMPTZ NULL;
