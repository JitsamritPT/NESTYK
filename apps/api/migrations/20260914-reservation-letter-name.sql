-- Existing databases: rename reservation document label from สัญญาจองห้อง.
UPDATE master_agreement_types
SET name_th = 'หนังสือจองห้อง'
WHERE code = 'reservation' AND name_th IS DISTINCT FROM 'หนังสือจองห้อง';
