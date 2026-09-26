-- DESIGN-024 D-02: a family save is household-owned and freezes one
-- publication. owner_id records who started it; access is by admission.
-- Fixture saves keep their setup preview and never carry a publication.

ALTER TABLE quest_saves ALTER COLUMN preview_id DROP NOT NULL;

ALTER TABLE quest_saves
  ADD COLUMN IF NOT EXISTS publication_id uuid,
  ADD COLUMN IF NOT EXISTS child_id uuid;

ALTER TABLE quest_journey_publications
  ADD CONSTRAINT quest_journey_publications_id_child_unique UNIQUE (id, child_id);

ALTER TABLE quest_saves
  ADD CONSTRAINT quest_saves_publication_child_fk
    FOREIGN KEY (publication_id, child_id)
    REFERENCES quest_journey_publications(id, child_id) ON DELETE RESTRICT,
  ADD CONSTRAINT quest_saves_family_pair
    CHECK ((publication_id IS NULL) = (child_id IS NULL)),
  ADD CONSTRAINT quest_saves_family_or_preview
    CHECK ((publication_id IS NULL) = (preview_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS quest_saves_child_created_idx
  ON quest_saves(child_id, created_at DESC)
  WHERE child_id IS NOT NULL;
