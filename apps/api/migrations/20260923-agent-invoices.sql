-- Standalone invoices that are not attached to a reservation letter.
CREATE TABLE IF NOT EXISTS agent_invoices (
  id SERIAL PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_no VARCHAR(40) NOT NULL,
  issue_date DATE NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  data JSONB NOT NULL,
  pdf_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agent_invoices_document UNIQUE (created_by_user_id, document_no)
);

CREATE INDEX IF NOT EXISTS idx_agent_invoices_agent
  ON agent_invoices (created_by_user_id, id DESC);
