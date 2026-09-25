-- DESIGN-024 D-02: household child profiles, revisioned memory drafts and
-- frozen journey publications. Private family data lives only here.

CREATE TABLE IF NOT EXISTS quest_children (
  id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  immich_name text NOT NULL CHECK (char_length(immich_name) BETWEEN 1 AND 120),
  immich_person_id text NOT NULL CHECK (char_length(immich_person_id) BETWEEN 1 AND 128),
  birth_date date NOT NULL,
  template_id text NOT NULL CHECK (template_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  template_version text NOT NULL CHECK (template_version ~ '^v[0-9]{1,4}$'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  -- Audit only. NULL records the operator CLI (DESIGN-024 D-09).
  created_by uuid REFERENCES quest_players(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES quest_players(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quest_children_person_unique
  ON quest_children(immich_person_id);

CREATE TABLE IF NOT EXISTS quest_journey_drafts (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES quest_children(id) ON DELETE CASCADE,
  template_id text NOT NULL CHECK (template_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  template_version text NOT NULL CHECK (template_version ~ '^v[0-9]{1,4}$'),
  seed text NOT NULL CHECK (char_length(seed) BETWEEN 8 AND 128),
  birth_date date NOT NULL,
  rebased_on date NOT NULL,
  chapters jsonb NOT NULL,
  slots jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_by uuid REFERENCES quest_players(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_journey_drafts_child_unique UNIQUE (child_id),
  CONSTRAINT quest_journey_drafts_chapters_array CHECK (jsonb_typeof(chapters) = 'array'),
  CONSTRAINT quest_journey_drafts_slots_array CHECK (jsonb_typeof(slots) = 'array')
);

CREATE TABLE IF NOT EXISTS quest_journey_publications (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES quest_children(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision >= 1),
  request_id uuid NOT NULL,
  draft_revision integer NOT NULL CHECK (draft_revision >= 0),
  birth_date date NOT NULL,
  plan jsonb NOT NULL,
  memories jsonb NOT NULL,
  versions jsonb NOT NULL,
  published_by uuid REFERENCES quest_players(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_journey_publications_revision_unique UNIQUE (child_id, revision),
  CONSTRAINT quest_journey_publications_request_unique UNIQUE (child_id, request_id),
  CONSTRAINT quest_journey_publications_plan_version
    CHECK (jsonb_typeof(plan) = 'object' AND plan->>'version' = 'family-world-plan-v1'),
  CONSTRAINT quest_journey_publications_memories_array CHECK (jsonb_typeof(memories) = 'array'),
  CONSTRAINT quest_journey_publications_versions_object CHECK (jsonb_typeof(versions) = 'object')
);
CREATE INDEX IF NOT EXISTS quest_journey_publications_child_latest_idx
  ON quest_journey_publications(child_id, revision DESC);
