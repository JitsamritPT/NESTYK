-- Make lease annexes optional: drop them from required checklist on a new template version.
LOCK TABLE agreement_templates IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  t RECORD;
  new_id INTEGER;
BEGIN
  FOR t IN
    SELECT DISTINCT ON (agreement_type_code) *
    FROM agreement_templates
    WHERE is_active AND form_kind = 'lease'
    ORDER BY agreement_type_code, version DESC
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM agreement_template_document_requirements
       WHERE template_id = t.id
         AND document_type_code IN ('lease_annex_1', 'lease_annex_2')
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO agreement_templates(
      agreement_type_code, version, name, form_kind, data_schema, document_template_key, is_active
    )
    VALUES (
      t.agreement_type_code,
      (SELECT COALESCE(MAX(version), 0) + 1 FROM agreement_templates WHERE agreement_type_code = t.agreement_type_code),
      t.name,
      t.form_kind,
      t.data_schema,
      t.document_template_key,
      TRUE
    )
    RETURNING id INTO new_id;

    INSERT INTO agreement_template_document_requirements(
      template_id, group_key, label, subject, document_type_code
    )
    SELECT new_id, group_key, label, subject, document_type_code
      FROM agreement_template_document_requirements
     WHERE template_id = t.id
       AND document_type_code NOT IN ('lease_annex_1', 'lease_annex_2');

    UPDATE agreement_templates
       SET is_active = FALSE
     WHERE agreement_type_code = t.agreement_type_code
       AND id <> new_id
       AND is_active;
  END LOOP;
END $$;
