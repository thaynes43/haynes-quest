CREATE INDEX IF NOT EXISTS quest_fixture_sessions_expires_idx
  ON quest_fixture_sessions(expires_at);

CREATE INDEX IF NOT EXISTS quest_setup_previews_expires_idx
  ON quest_setup_previews(expires_at);
