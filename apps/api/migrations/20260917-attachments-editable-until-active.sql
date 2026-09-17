-- Keep agreement attachments editable through signing until the contract is active
-- (reservation letter generated) or otherwise closed.
CREATE OR REPLACE FUNCTION protect_agreement_document() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE c RECORD; old_doc RECORD; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Document history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM lease_contracts WHERE id=NEW.agreement_id FOR UPDATE;
  IF c.status NOT IN ('draft','awaiting_signatures','awaiting_agent_review')
     OR (c.document_url IS NOT NULL AND c.document_url LIKE '%/generated/reservation_letter/%') THEN
    RAISE EXCEPTION 'Signed or closed agreement documents cannot be changed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN
    IF OLD.removed_at IS NOT NULL OR NEW.removed_at IS NULL OR
      (to_jsonb(NEW)-'removed_at') IS DISTINCT FROM (to_jsonb(OLD)-'removed_at') OR
      EXISTS(SELECT 1 FROM agreement_documents WHERE supersedes_document_id=OLD.id) THEN
      RAISE EXCEPTION 'Only a current document can be removed' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND OLD.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Removed documents cannot be changed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['review_status','reviewed_by_user_id','reviewed_at','review_note']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['review_status','reviewed_by_user_id','reviewed_at','review_note']) OR OLD.review_status <> 'pending' THEN
      RAISE EXCEPTION 'Add a new document revision instead of changing document history' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.supersedes_document_id IS NOT NULL THEN
    SELECT * INTO old_doc FROM agreement_documents WHERE id=NEW.supersedes_document_id;
    IF old_doc.removed_at IS NOT NULL OR old_doc.agreement_id <> NEW.agreement_id OR old_doc.subject <> NEW.subject OR old_doc.document_type_code <> NEW.document_type_code THEN
      RAISE EXCEPTION 'Replacement must match agreement, subject and document type' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_document_history ON agreement_documents;
CREATE TRIGGER agreement_document_history BEFORE INSERT OR UPDATE OR DELETE ON agreement_documents
FOR EACH ROW EXECUTE FUNCTION protect_agreement_document();
