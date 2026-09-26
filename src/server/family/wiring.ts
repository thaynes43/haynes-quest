/**
 * Family-release wiring shared by the server entrypoint and the operator CLI.
 * Keep it free of side effects: both processes import it.
 */
import { deriveSessionSubkey, deriveSubjectIdSecret } from '../auth/secrets.js';
import { calendarDate, type ServerConfig } from '../config.js';
import { PostgresQuestStore } from '../db/postgres-store.js';
import type { QuestStore } from '../domain.js';
import type { ImmichPhotoSource } from '../photos/immich.js';
import { createPrivateImmichAdapter } from '../photos/private.js';
import { PostgresFamilyStore } from './postgres-store.js';
import { FamilyJourneyService } from './service.js';
import { FamilyTemplateRegistry } from './templates.js';
import { CandidateTokens } from './tokens.js';

/** Never change: frozen opaque photo references are derived from it. */
export const FAMILY_IMMICH_CONNECTION_ID = 'family-immich-v1';
const CANDIDATE_TOKEN_LABEL = 'haynes-quest/candidate-token/v1';

/** The Immich adapter for the family release; null in fixture mode or without Immich. */
export function createConfiguredImmich(config: ServerConfig): ImmichPhotoSource | null {
  if (config.fixtureMode || !config.immich) return null;
  return createPrivateImmichAdapter({
    url: config.immich.url,
    apiKey: config.immich.apiKey,
    allowedOrigins: config.immich.allowedOrigins,
    subjectIdSecret: deriveSubjectIdSecret(config.sessionSecret),
    connectionId: FAMILY_IMMICH_CONNECTION_ID,
  });
}

/** Family journeys (DESIGN-024) on the family release's Postgres pool. */
export function createConfiguredFamily(
  config: ServerConfig,
  store: QuestStore,
  immich: ImmichPhotoSource | null,
) {
  if (config.fixtureMode || !(store instanceof PostgresQuestStore)) return null;
  const familyStore = new PostgresFamilyStore(store.pool);
  const templates = new FamilyTemplateRegistry();
  const today = () => calendarDate(new Date(), config.householdTimeZone);
  const service = immich
    ? new FamilyJourneyService({
        store: familyStore,
        library: immich,
        templates,
        tokens: new CandidateTokens(deriveSessionSubkey(config.sessionSecret, CANDIDATE_TOKEN_LABEL)),
        today,
      })
    : null;
  return { store: familyStore, templates, service, today };
}

