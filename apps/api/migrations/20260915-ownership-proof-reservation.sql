-- Run after agreement-attachments, inside a transaction.
-- Publish new versions; never rewrite the checklist of existing agreements.
LOCK TABLE agreement_templates IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE t RECORD; new_id INTEGER; BEGIN
  FOR t IN SELECT DISTINCT ON (agreement_type_code) * FROM agreement_templates
    WHERE is_active AND form_kind IN ('lease','reservation')
    ORDER BY agreement_type_code,version DESC
  LOOP
    IF (t.form_kind = 'lease' AND EXISTS (
        SELECT 1 FROM agreement_template_document_requirements
        WHERE template_id=t.id AND subject='property' AND document_type_code='ownership_proof'))
      OR (t.form_kind = 'reservation' AND NOT EXISTS (
        SELECT 1 FROM agreement_template_document_requirements
        WHERE template_id=t.id AND subject='property' AND document_type_code='ownership_proof')) THEN
      INSERT INTO agreement_templates(agreement_type_code,version,name,form_kind,data_schema,document_template_key)
      VALUES(t.agreement_type_code,(SELECT MAX(version)+1 FROM agreement_templates WHERE agreement_type_code=t.agreement_type_code),
        t.name,t.form_kind,t.data_schema,t.document_template_key) RETURNING id INTO new_id;
      INSERT INTO agreement_template_document_requirements(template_id,group_key,label,subject,document_type_code)
      SELECT new_id,group_key,label,subject,document_type_code FROM agreement_template_document_requirements
      WHERE template_id=t.id AND NOT (subject='property' AND document_type_code='ownership_proof');
      IF t.form_kind = 'reservation' THEN
        INSERT INTO agreement_template_document_requirements(template_id,group_key,label,subject,document_type_code)
        VALUES(new_id,'ownership','หลักฐานกรรมสิทธิ์ห้อง','property','ownership_proof');
      END IF;
      UPDATE agreement_templates SET is_active=FALSE WHERE agreement_type_code=t.agreement_type_code AND id<>new_id;
    END IF;
  END LOOP;
END $$;
