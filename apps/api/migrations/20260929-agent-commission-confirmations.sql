CREATE TABLE IF NOT EXISTS agent_commission_confirmations (
  id SERIAL PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_no VARCHAR(40) NOT NULL,
  issue_date DATE NOT NULL,
  tenant_id INTEGER REFERENCES tenants (id) ON DELETE SET NULL,
  landlord_name VARCHAR(80) NOT NULL,
  data JSONB NOT NULL,
  pdf_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agent_commission_confirmations_document
    UNIQUE (created_by_user_id, document_no)
);

CREATE INDEX IF NOT EXISTS idx_agent_commission_confirmations_agent
  ON agent_commission_confirmations (created_by_user_id, id DESC);
