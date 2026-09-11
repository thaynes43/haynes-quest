ALTER TABLE quest_saves
  ADD COLUMN save_format text NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN adventure_plan jsonb,
  ADD COLUMN adventure_state jsonb;

ALTER TABLE quest_saves
  ADD CONSTRAINT quest_saves_format_known
    CHECK (save_format IN ('legacy-v1', 'era-combat-v2')),
  ADD CONSTRAINT quest_saves_adventure_shape
    CHECK (
      (save_format = 'legacy-v1' AND adventure_plan IS NULL AND adventure_state IS NULL)
      OR
      (
        save_format = 'era-combat-v2'
        AND adventure_plan IS NOT NULL
        AND adventure_state IS NOT NULL
        AND jsonb_typeof(adventure_plan) = 'object'
        AND jsonb_typeof(adventure_state) = 'object'
      )
    );
