import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Ability, AppearanceStage, RuleVersions, SubjectOption } from '../../shared/contracts.js';
import type { FrozenMemory } from '../domain.js';

export const players = pgTable('quest_players', {
  id: uuid('id').primaryKey(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const fixtureSessions = pgTable(
  'quest_fixture_sessions',
  {
    id: uuid('id').primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('quest_fixture_sessions_player_idx').on(table.playerId)],
);

export const setupPreviews = pgTable(
  'quest_setup_previews',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    subjects: jsonb('subjects').$type<SubjectOption[]>().notNull(),
    chosenSubject: jsonb('chosen_subject').$type<SubjectOption | null>(),
    memories: jsonb('memories').$type<FrozenMemory[]>().notNull(),
    selectedIds: jsonb('selected_ids').$type<string[]>().notNull(),
    coverage: jsonb('coverage')
      .$type<{ fromDate: string | null; toDate: string | null; incomplete: boolean; scanned: number }>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [index('quest_setup_previews_owner_idx').on(table.ownerId, table.createdAt)],
);

export const saves = pgTable(
  'quest_saves',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    previewId: uuid('preview_id')
      .notNull()
      .references(() => setupPreviews.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    subject: jsonb('subject').$type<SubjectOption>().notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    memories: jsonb('memories').$type<FrozenMemory[]>().notNull(),
    recoveredIds: jsonb('recovered_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ageYears: integer('age_years').notNull().default(0),
    abilities: jsonb('abilities').$type<Ability[]>().notNull(),
    appearanceStage: text('appearance_stage').$type<AppearanceStage>().notNull(),
    completed: boolean('completed').notNull().default(false),
    revision: integer('revision').notNull().default(0),
    versions: jsonb('versions').$type<RuleVersions>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('quest_saves_preview_unique').on(table.previewId),
    index('quest_saves_owner_updated_idx').on(table.ownerId, table.updatedAt),
  ],
);

export const questSchema = { players, fixtureSessions, setupPreviews, saves };
