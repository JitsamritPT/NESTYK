ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS owner_signature_url TEXT NULL;
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS tenant_signature_url TEXT NULL;
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS agent_signature_url TEXT NULL;
