ALTER TABLE quest_saves
  ADD COLUMN friendly_state jsonb;

ALTER TABLE quest_saves
  ADD CONSTRAINT quest_saves_friendly_state_object
    CHECK (friendly_state IS NULL OR jsonb_typeof(friendly_state) = 'object');
