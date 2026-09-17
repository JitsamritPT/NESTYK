-- Restore required-document gate before first signature (ownership checklist, etc.).
CREATE OR REPLACE FUNCTION require_agreement_documents_before_signing() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF OLD.owner_signed_at IS NULL AND OLD.tenant_signed_at IS NULL AND OLD.agent_signed_at IS NULL
    AND (NEW.owner_signed_at IS NOT NULL OR NEW.tenant_signed_at IS NOT NULL OR NEW.agent_signed_at IS NOT NULL)
    AND EXISTS (
      SELECT r.group_key FROM agreement_template_document_requirements r WHERE r.template_id=NEW.template_id
      GROUP BY r.group_key HAVING NOT bool_or(EXISTS(
        SELECT 1 FROM agreement_documents d WHERE d.agreement_id=NEW.id AND d.subject=r.subject
          AND d.document_type_code=r.document_type_code AND d.removed_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM agreement_documents next WHERE next.supersedes_document_id=d.id)
      ))
    ) THEN RAISE EXCEPTION 'Required agreement documents must be attached before signing' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_document_signing_gate ON lease_contracts;
CREATE TRIGGER agreement_document_signing_gate BEFORE UPDATE ON lease_contracts
FOR EACH ROW EXECUTE FUNCTION require_agreement_documents_before_signing();
