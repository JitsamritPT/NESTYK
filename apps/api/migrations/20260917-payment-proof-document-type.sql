-- Optional supporting document type for reservation payment slips.
INSERT INTO master_document_types(code, name_th) VALUES
  ('payment_proof', 'หลักฐานการจ่ายเงิน')
ON CONFLICT DO NOTHING;
