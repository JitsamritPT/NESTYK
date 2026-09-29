-- One receipt belongs to one standalone invoice.
ALTER TABLE agent_invoices
  ADD COLUMN IF NOT EXISTS receipt_document_no VARCHAR(40),
  ADD COLUMN IF NOT EXISTS receipt_issue_date DATE,
  ADD COLUMN IF NOT EXISTS receipt_data JSONB,
  ADD COLUMN IF NOT EXISTS receipt_pdf_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_invoices_receipt_no
  ON agent_invoices (created_by_user_id, receipt_document_no)
  WHERE receipt_document_no IS NOT NULL;
