-- Keep ID/passport and nationality on the login user so the next reservation can refill them.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS identity_number VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(120) NULL;
