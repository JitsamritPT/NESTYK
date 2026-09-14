-- Reservation letter documents: reuse document_url as ใบจอง; add invoice and receipt.
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS invoice_url TEXT NULL;
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL;
