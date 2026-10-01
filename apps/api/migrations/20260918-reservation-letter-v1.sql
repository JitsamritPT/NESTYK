-- Publish reservation letter-v1 template (new version; never rewrite existing).
LOCK TABLE agreement_templates IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  t RECORD;
  new_id INTEGER;
  next_version INTEGER;
  schema jsonb := jsonb_build_object(
    'type', 'object',
    'required', jsonb_build_array('startDate', 'moveInDate', 'reservationFee'),
    'properties', jsonb_build_object(
      'startDate', jsonb_build_object('type', 'string'),
      'moveInDate', jsonb_build_object('type', 'string'),
      'reservationFee', jsonb_build_object('type', 'number', 'minimum', 0),
      'reservationLetter', jsonb_build_object('type', 'object')
    ),
    'additionalProperties', false
  );
BEGIN
  FOR t IN
    SELECT DISTINCT ON (agreement_type_code) *
    FROM agreement_templates
    WHERE is_active AND form_kind = 'reservation'
    ORDER BY agreement_type_code, version DESC
  LOOP
    IF t.document_template_key = 'reservation/letter-v1'
       AND t.data_schema ? 'properties'
       AND (t.data_schema->'properties') ? 'reservationLetter' THEN
      CONTINUE;
    END IF;
    SELECT COALESCE(MAX(version), 0) + 1
      INTO next_version
      FROM agreement_templates
     WHERE agreement_type_code = t.agreement_type_code;

    INSERT INTO agreement_templates(
      agreement_type_code, version, name, form_kind, data_schema, document_template_key
    )
    VALUES (
      t.agreement_type_code,
      next_version,
      'หนังสือจองเช่าที่อยู่อาศัย',
      'reservation',
      schema,
      'reservation/letter-v1'
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
       AND id <> new_id;
  END LOOP;
END $$;
