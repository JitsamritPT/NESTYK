-- Apply transactionally after agreement-templates-renewals.
CREATE TABLE IF NOT EXISTS master_document_types (
  code VARCHAR(64) PRIMARY KEY,
  name_th VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO master_document_types(code,name_th) VALUES
 ('national_id','สำเนาบัตรประชาชน'), ('passport','สำเนาพาสปอร์ต'),
 ('ownership_proof','เอกสารแสดงกรรมสิทธิ์ห้อง'), ('power_of_attorney','หนังสือมอบอำนาจ'),
 ('other','เอกสารประกอบอื่น') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS agreement_template_document_requirements (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES agreement_templates(id) ON DELETE RESTRICT,
  group_key VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  subject VARCHAR(32) NOT NULL CHECK(subject IN ('tenant','owner','property','representative')),
  document_type_code VARCHAR(64) NOT NULL REFERENCES master_document_types(code) ON DELETE RESTRICT,
  UNIQUE(template_id,group_key,document_type_code)
);
CREATE TABLE IF NOT EXISTS agreement_documents (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES lease_contracts(id) ON DELETE RESTRICT,
  document_type_code VARCHAR(64) NOT NULL REFERENCES master_document_types(code) ON DELETE RESTRICT,
  subject VARCHAR(32) NOT NULL CHECK(subject IN ('tenant','owner','property','representative')),
  file_path TEXT NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(64) NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
  byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 10485760),
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','accepted','rejected')),
  reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(1000),
  supersedes_document_id INTEGER UNIQUE REFERENCES agreement_documents(id) ON DELETE RESTRICT,
  source_document_id INTEGER REFERENCES agreement_documents(id) ON DELETE RESTRICT,
  CHECK ((review_status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
      OR (review_status <> 'pending' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_agreement_documents_contract ON agreement_documents(agreement_id);
ALTER TABLE master_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_template_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_documents ENABLE ROW LEVEL SECURITY;

-- Preserve already-pinned templates. New leases default to a new version with a checklist.
DO $$ DECLARE t RECORD; new_id INTEGER; BEGIN
  FOR t IN SELECT DISTINCT ON (agreement_type_code) * FROM agreement_templates a
    WHERE form_kind = 'lease' AND is_active AND NOT EXISTS (
      SELECT 1 FROM agreement_template_document_requirements r JOIN agreement_templates x ON x.id=r.template_id
      WHERE x.agreement_type_code=a.agreement_type_code)
    ORDER BY agreement_type_code,version DESC
  LOOP
    INSERT INTO agreement_templates(agreement_type_code,version,name,form_kind,data_schema,document_template_key)
    VALUES(t.agreement_type_code,(SELECT MAX(version)+1 FROM agreement_templates WHERE agreement_type_code=t.agreement_type_code),
      t.name,t.form_kind,t.data_schema,t.document_template_key) RETURNING id INTO new_id;
    UPDATE agreement_templates SET is_active=FALSE WHERE agreement_type_code=t.agreement_type_code AND id<>new_id;
    INSERT INTO agreement_template_document_requirements(template_id,group_key,label,subject,document_type_code) VALUES
      (new_id,'tenant_identity','ยืนยันตัวตนผู้เช่า','tenant','national_id'),
      (new_id,'tenant_identity','ยืนยันตัวตนผู้เช่า','tenant','passport'),
      (new_id,'owner_identity','ยืนยันตัวตนผู้ให้เช่า','owner','national_id'),
      (new_id,'owner_identity','ยืนยันตัวตนผู้ให้เช่า','owner','passport'),
      (new_id,'ownership','หลักฐานกรรมสิทธิ์ห้อง','property','ownership_proof');
  END LOOP;
END $$;

-- Requirements become immutable once any contract pins their template.
CREATE OR REPLACE FUNCTION protect_agreement_requirements() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM lease_contracts WHERE template_id = CASE WHEN TG_OP='DELETE' THEN OLD.template_id ELSE NEW.template_id END)
    OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM lease_contracts WHERE template_id=OLD.template_id)) THEN
    RAISE EXCEPTION 'Create a new template version to change document requirements';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS agreement_requirements_immutable ON agreement_template_document_requirements;
CREATE TRIGGER agreement_requirements_immutable BEFORE INSERT OR UPDATE OR DELETE ON agreement_template_document_requirements
FOR EACH ROW EXECUTE FUNCTION protect_agreement_requirements();

-- Lock the parent for all mutations, so uploads/reviews cannot race signing.
CREATE OR REPLACE FUNCTION protect_agreement_document() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE c RECORD; old_doc RECORD; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Document history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM lease_contracts WHERE id=NEW.agreement_id FOR UPDATE;
  IF c.status NOT IN ('draft','awaiting_signatures') OR c.owner_signed_at IS NOT NULL OR c.tenant_signed_at IS NOT NULL OR c.agent_signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Signed or closed agreement documents cannot be changed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['review_status','reviewed_by_user_id','reviewed_at','review_note']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['review_status','reviewed_by_user_id','reviewed_at','review_note']) OR OLD.review_status <> 'pending' THEN
      RAISE EXCEPTION 'Add a new document revision instead of changing document history' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.supersedes_document_id IS NOT NULL THEN
    SELECT * INTO old_doc FROM agreement_documents WHERE id=NEW.supersedes_document_id;
    IF old_doc.agreement_id <> NEW.agreement_id OR old_doc.subject <> NEW.subject OR old_doc.document_type_code <> NEW.document_type_code THEN
      RAISE EXCEPTION 'Replacement must match agreement, subject and document type' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_document_history ON agreement_documents;
CREATE TRIGGER agreement_document_history BEFORE INSERT OR UPDATE OR DELETE ON agreement_documents
FOR EACH ROW EXECUTE FUNCTION protect_agreement_document();

CREATE OR REPLACE FUNCTION require_agreement_documents_before_signing() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF OLD.owner_signed_at IS NULL AND OLD.tenant_signed_at IS NULL AND OLD.agent_signed_at IS NULL
    AND (NEW.owner_signed_at IS NOT NULL OR NEW.tenant_signed_at IS NOT NULL OR NEW.agent_signed_at IS NOT NULL)
    AND EXISTS (
      SELECT r.group_key FROM agreement_template_document_requirements r WHERE r.template_id=NEW.template_id
      GROUP BY r.group_key HAVING NOT bool_or(EXISTS(
        SELECT 1 FROM agreement_documents d WHERE d.agreement_id=NEW.id AND d.subject=r.subject
          AND d.document_type_code=r.document_type_code AND d.review_status='accepted'
          AND NOT EXISTS(SELECT 1 FROM agreement_documents next WHERE next.supersedes_document_id=d.id)
      ))
    ) THEN RAISE EXCEPTION 'Required agreement documents must be accepted before signing' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_document_signing_gate ON lease_contracts;
CREATE TRIGGER agreement_document_signing_gate BEFORE UPDATE ON lease_contracts
FOR EACH ROW EXECUTE FUNCTION require_agreement_documents_before_signing();
