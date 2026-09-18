-- Optional supporting document for co-broke commission split between agents.
INSERT INTO master_document_types(code, name_th) VALUES
  ('agent_commission_agreement', 'ข้อตกลงแบ่งค่าคอมมิชชั่นระหว่างเอเจนท์')
ON CONFLICT DO NOTHING;
