-- Existing databases: invoice and receipt attachments for reservation letters.
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS invoice_url TEXT NULL;
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL;
