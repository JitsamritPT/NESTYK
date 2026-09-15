CREATE TABLE IF NOT EXISTS agreement_sign_invites (
  id serial PRIMARY KEY,
  agreement_id int NOT NULL REFERENCES lease_contracts (id) ON DELETE CASCADE,
  party varchar(16) NOT NULL CHECK (party IN ('owner', 'tenant')),
  token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by_user_id int NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agreement_sign_invites_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_agreement_sign_invites_agreement_party
  ON agreement_sign_invites (agreement_id, party)
  WHERE used_at IS NULL AND revoked_at IS NULL;
