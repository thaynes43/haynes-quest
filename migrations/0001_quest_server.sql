CREATE TABLE IF NOT EXISTS quest_players (
  id uuid PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quest_fixture_sessions (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES quest_players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quest_fixture_sessions_player_idx ON quest_fixture_sessions(player_id);

CREATE TABLE IF NOT EXISTS quest_setup_previews (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES quest_players(id) ON DELETE CASCADE,
  birth_date date NOT NULL,
  subjects jsonb NOT NULL,
  chosen_subject jsonb,
  memories jsonb NOT NULL,
  selected_ids jsonb NOT NULL,
  coverage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT quest_setup_previews_subjects_array CHECK (jsonb_typeof(subjects) = 'array'),
  CONSTRAINT quest_setup_previews_memories_array CHECK (jsonb_typeof(memories) = 'array'),
  CONSTRAINT quest_setup_previews_selected_ids_array CHECK (jsonb_typeof(selected_ids) = 'array'),
  CONSTRAINT quest_setup_previews_coverage_object CHECK (jsonb_typeof(coverage) = 'object')
);
CREATE INDEX IF NOT EXISTS quest_setup_previews_owner_idx ON quest_setup_previews(owner_id, created_at);

CREATE TABLE IF NOT EXISTS quest_saves (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES quest_players(id) ON DELETE CASCADE,
  preview_id uuid NOT NULL REFERENCES quest_setup_previews(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  subject jsonb NOT NULL,
  birth_date date NOT NULL,
  memories jsonb NOT NULL,
  recovered_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  age_years integer NOT NULL DEFAULT 0 CHECK (age_years >= 0),
  abilities jsonb NOT NULL,
  appearance_stage text NOT NULL CHECK (appearance_stage IN ('infant', 'child')),
  completed boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  versions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_saves_subject_object CHECK (jsonb_typeof(subject) = 'object'),
  CONSTRAINT quest_saves_memories_array CHECK (jsonb_typeof(memories) = 'array'),
  CONSTRAINT quest_saves_recovered_ids_array CHECK (jsonb_typeof(recovered_ids) = 'array'),
  CONSTRAINT quest_saves_abilities_array CHECK (jsonb_typeof(abilities) = 'array'),
  CONSTRAINT quest_saves_versions_object CHECK (jsonb_typeof(versions) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS quest_saves_preview_unique ON quest_saves(preview_id);
CREATE INDEX IF NOT EXISTS quest_saves_owner_updated_idx ON quest_saves(owner_id, updated_at);
