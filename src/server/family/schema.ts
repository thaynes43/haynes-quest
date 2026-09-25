import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { RuleVersions } from '../../shared/contracts.js';
import type { FamilyWorldAdventurePlanV1 } from '../../shared/family-plan.js';
import { players } from '../db/schema.js';
import type { FrozenMemory } from '../domain.js';
import type { DraftChapter, DraftSlot } from './store.js';

/** Mirrors migrations/0005_family_journeys.sql. */
export const children = pgTable(
  'quest_children',
  {
    id: uuid('id').primaryKey(),
    displayName: text('display_name').notNull(),
    immichName: text('immich_name').notNull(),
    immichPersonId: text('immich_person_id').notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    templateId: text('template_id').notNull(),
    templateVersion: text('template_version').notNull(),
    revision: integer('revision').notNull().default(0),
    createdBy: uuid('created_by').references(() => players.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => players.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('quest_children_person_unique').on(table.immichPersonId)],
);

export const journeyDrafts = pgTable(
  'quest_journey_drafts',
  {
    id: uuid('id').primaryKey(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    templateId: text('template_id').notNull(),
    templateVersion: text('template_version').notNull(),
    seed: text('seed').notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    rebasedOn: date('rebased_on', { mode: 'string' }).notNull(),
    chapters: jsonb('chapters').$type<DraftChapter[]>().notNull(),
    slots: jsonb('slots').$type<DraftSlot[]>().notNull(),
    revision: integer('revision').notNull().default(0),
    updatedBy: uuid('updated_by').references(() => players.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [unique('quest_journey_drafts_child_unique').on(table.childId)],
);

export const journeyPublications = pgTable(
  'quest_journey_publications',
  {
    id: uuid('id').primaryKey(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    requestId: uuid('request_id').notNull(),
    draftRevision: integer('draft_revision').notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    plan: jsonb('plan').$type<FamilyWorldAdventurePlanV1>().notNull(),
    memories: jsonb('memories').$type<FrozenMemory[]>().notNull(),
    versions: jsonb('versions').$type<RuleVersions>().notNull(),
    publishedBy: uuid('published_by').references(() => players.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    unique('quest_journey_publications_revision_unique').on(table.childId, table.revision),
    unique('quest_journey_publications_request_unique').on(table.childId, table.requestId),
    index('quest_journey_publications_child_latest_idx').on(table.childId, table.revision),
  ],
);

export const familySchema = { children, journeyDrafts, journeyPublications };
