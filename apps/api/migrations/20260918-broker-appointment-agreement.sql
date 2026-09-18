-- Broker appointment as first-class agreement form_kind (same PDF template assets).
ALTER TABLE master_agreement_types
  DROP CONSTRAINT IF EXISTS chk_agreement_form_kind;
ALTER TABLE master_agreement_types
  ADD CONSTRAINT chk_agreement_form_kind
  CHECK (form_kind IN ('reservation', 'lease', 'broker_appointment'));

ALTER TABLE agreement_templates
  DROP CONSTRAINT IF EXISTS agreement_templates_form_kind_check;
ALTER TABLE agreement_templates
  ADD CONSTRAINT agreement_templates_form_kind_check
  CHECK (form_kind IN ('reservation', 'lease', 'broker_appointment'));

INSERT INTO master_agreement_types (code, name_th, name_en, icon, form_kind, sort_order)
VALUES (
  'broker_appointment',
  'สัญญาแต่งตั้งนายหน้า',
  'Broker appointment agreement',
  'handshake',
  'broker_appointment',
  15
)
ON CONFLICT (code) DO UPDATE
SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  form_kind = EXCLUDED.form_kind,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO agreement_templates (
  agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active
)
SELECT
  'broker_appointment',
  1,
  'สัญญาแต่งตั้งนายหน้า (สำหรับเช่า)',
  'broker_appointment',
  jsonb_build_object(
    'type', 'object',
    'required', jsonb_build_array('startDate'),
    'properties', jsonb_build_object(
      'startDate', jsonb_build_object('type', 'string'),
      'brokerAppointment', jsonb_build_object('type', 'object')
    ),
    'additionalProperties', false
  ),
  'broker_appointment/v1',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM agreement_templates
  WHERE agreement_type_code = 'broker_appointment' AND is_active
);

UPDATE agreement_templates
SET is_active = FALSE
WHERE agreement_type_code = 'broker_appointment'
  AND id <> (
    SELECT id FROM agreement_templates
    WHERE agreement_type_code = 'broker_appointment'
    ORDER BY version DESC
    LIMIT 1
  );
