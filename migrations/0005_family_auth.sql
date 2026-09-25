-- ADR-005 / DESIGN-024 D-02: family sign-in.
-- A family player is keyed by the immutable (issuer, subject) pair. Fixture
-- players keep both columns null, so the unique constraint never touches them.
ALTER TABLE quest_players
  ADD COLUMN IF NOT EXISTS oidc_issuer text,
  ADD COLUMN IF NOT EXISTS oidc_subject text,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS groups_checked_at timestamptz;

ALTER TABLE quest_players
  ADD CONSTRAINT quest_players_oidc_identity_pair
    CHECK ((oidc_issuer IS NULL) = (oidc_subject IS NULL)),
  ADD CONSTRAINT quest_players_oidc_identity_values
    CHECK (
      oidc_issuer IS NULL
      OR (char_length(oidc_issuer) BETWEEN 1 AND 2048 AND char_length(oidc_subject) BETWEEN 1 AND 255)
    ),
  ADD CONSTRAINT quest_players_family_groups_checked
    CHECK (oidc_subject IS NULL OR groups_checked_at IS NOT NULL),
  ADD CONSTRAINT quest_players_fixture_not_admin
    CHECK (oidc_subject IS NOT NULL OR is_admin = false),
  ADD CONSTRAINT quest_players_oidc_identity_unique UNIQUE (oidc_issuer, oidc_subject);

-- Better Auth 1.7 tables, mapped onto snake_case columns by src/server/auth.
-- Email and name on quest_auth_users are display plumbing only: the email is
-- a synthetic per-identity value and never an identity key.
CREATE TABLE IF NOT EXISTS quest_auth_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quest_auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES quest_auth_users(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES quest_players(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quest_auth_sessions_user_idx ON quest_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS quest_auth_sessions_player_idx ON quest_auth_sessions(player_id);
CREATE INDEX IF NOT EXISTS quest_auth_sessions_expires_idx ON quest_auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS quest_auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES quest_auth_users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_auth_accounts_provider_account_unique UNIQUE (provider_id, account_id)
);
CREATE INDEX IF NOT EXISTS quest_auth_accounts_user_idx ON quest_auth_accounts(user_id);

CREATE TABLE IF NOT EXISTS quest_auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quest_auth_verifications_identifier_idx ON quest_auth_verifications(identifier);
CREATE INDEX IF NOT EXISTS quest_auth_verifications_expires_idx ON quest_auth_verifications(expires_at);
