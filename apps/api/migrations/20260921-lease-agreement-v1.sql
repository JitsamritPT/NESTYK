-- Publish lease/v1 template (new version; never rewrite existing).
LOCK TABLE agreement_templates IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  t RECORD;
  new_id INTEGER;
  next_version INTEGER;
  schema jsonb := jsonb_build_object(
    'type', 'object',
    'required', jsonb_build_array('startDate', 'endDate', 'monthlyRent', 'deposit'),
    'properties', jsonb_build_object(
      'startDate', jsonb_build_object('type', 'string'),
      'endDate', jsonb_build_object('type', 'string'),
      'monthlyRent', jsonb_build_object('type', 'number', 'exclusiveMinimum', 0),
      'deposit', jsonb_build_object('type', 'number', 'minimum', 0),
      'leaseAgreement', jsonb_build_object('type', 'object')
    ),
    'additionalProperties', false
  );
BEGIN
  FOR t IN
    SELECT DISTINCT ON (agreement_type_code) *
    FROM agreement_templates
    WHERE is_active AND form_kind = 'lease'
    ORDER BY agreement_type_code, version DESC
  LOOP
    IF t.document_template_key = 'lease/v1'
       AND t.data_schema ? 'properties'
       AND (t.data_schema->'properties') ? 'leaseAgreement' THEN
      CONTINUE;
    END IF;
    SELECT COALESCE(MAX(version), 0) + 1
      INTO next_version
      FROM agreement_templates
     WHERE agreement_type_code = t.agreement_type_code;

    INSERT INTO agreement_templates(
      agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active
    )
    VALUES (
      t.agreement_type_code,
      next_version,
      'สัญญาเช่าเพื่ออยู่อาศัย',
      'lease',
      schema,
      'lease/v1',
      TRUE
    )
    RETURNING id INTO new_id;

    INSERT INTO agreement_template_document_requirements(
      template_id, group_key, label, subject, document_type_code
    )
    SELECT new_id, group_key, label, subject, document_type_code
      FROM agreement_template_document_requirements
     WHERE template_id = t.id;

    UPDATE agreement_templates
       SET is_active = FALSE
     WHERE agreement_type_code = t.agreement_type_code
       AND id <> new_id
       AND is_active;
  END LOOP;

  -- Fallback when no active lease template exists yet.
  IF NOT EXISTS (
    SELECT 1 FROM agreement_templates
     WHERE agreement_type_code = 'lease' AND is_active
       AND document_template_key = 'lease/v1'
  ) AND EXISTS (
    SELECT 1 FROM master_agreement_types WHERE code = 'lease'
  ) THEN
    INSERT INTO agreement_templates(
      agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active
    )
    SELECT
      'lease',
      COALESCE((SELECT MAX(version) FROM agreement_templates WHERE agreement_type_code = 'lease'), 0) + 1,
      'สัญญาเช่าเพื่ออยู่อาศัย',
      'lease',
      schema,
      'lease/v1',
      TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM agreement_templates
       WHERE agreement_type_code = 'lease' AND document_template_key = 'lease/v1' AND is_active
    );
  END IF;
END $$;
