-- An invoice opened from a tenant is paid by that tenant.
ALTER TABLE agent_invoices
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_invoices_tenant
  ON agent_invoices (tenant_id, id DESC);
