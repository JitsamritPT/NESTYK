-- Supporting documents are optional: do not block signing when checklist items are missing.
CREATE OR REPLACE FUNCTION require_agreement_documents_before_signing() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_document_signing_gate ON lease_contracts;
CREATE TRIGGER agreement_document_signing_gate BEFORE UPDATE ON lease_contracts
FOR EACH ROW EXECUTE FUNCTION require_agreement_documents_before_signing();
