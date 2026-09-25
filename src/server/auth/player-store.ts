import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PlayerRole } from '../../shared/contracts.js';
import type { PlayerRecord } from '../domain.js';

/** An admitted household member. Keyed in storage by the immutable `(issuer, subject)` pair. */
export interface FamilyPlayer extends PlayerRecord {
  role: PlayerRole;
}

/** What one successful sign-in establishes about a person (ADR-005 D-02, D-03). */
export interface FamilyIdentity {
  issuer: string;
  subject: string;
  /** Display only; never an identity key. */
  label: string;
  role: PlayerRole;
}

export interface FamilyPlayerRecord extends FamilyPlayer {
  /** When group membership was last checked, at sign-in. */
  groupsCheckedAt: Date;
}

export interface FamilyPlayerStore {
  /** Creates or refreshes the player for `(issuer, subject)`; the player id never changes. */
  upsertFamilyPlayer(identity: FamilyIdentity, checkedAt: Date): Promise<FamilyPlayerRecord>;
  /** Returns only family players; fixture players (no identity) are never returned. */
  getFamilyPlayer(playerId: string): Promise<FamilyPlayerRecord | null>;
  /** Removes expired sign-in state and sessions. */
  deleteExpiredAuthRecords(now: Date): Promise<number>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Test and development double. Postgres is the only production store. */
export class InMemoryFamilyPlayerStore implements FamilyPlayerStore {
  private readonly players = new Map<string, FamilyPlayerRecord & { issuer: string; subject: string }>();

  async upsertFamilyPlayer(identity: FamilyIdentity, checkedAt: Date): Promise<FamilyPlayerRecord> {
    const existing = [...this.players.values()].find(
      (player) => player.issuer === identity.issuer && player.subject === identity.subject,
    );
    const record = {
      id: existing?.id ?? randomUUID(),
      label: identity.label,
      role: identity.role,
      groupsCheckedAt: new Date(checkedAt),
      issuer: identity.issuer,
      subject: identity.subject,
    };
    this.players.set(record.id, record);
    return toRecord(record);
  }

  async getFamilyPlayer(playerId: string): Promise<FamilyPlayerRecord | null> {
    const record = this.players.get(playerId);
    return record ? toRecord(record) : null;
  }

  async deleteExpiredAuthRecords(): Promise<number> {
    return 0;
  }

  /** Test inspection only. */
  count(): number {
    return this.players.size;
  }
}

export class PostgresFamilyPlayerStore implements FamilyPlayerStore {
  constructor(private readonly pool: Pool) {}

  async upsertFamilyPlayer(identity: FamilyIdentity, checkedAt: Date): Promise<FamilyPlayerRecord> {
    const result = await this.pool.query<PlayerRow>(
      `
        INSERT INTO quest_players (id, label, oidc_issuer, oidc_subject, is_admin, groups_checked_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (oidc_issuer, oidc_subject) DO UPDATE
          SET label = EXCLUDED.label,
              is_admin = EXCLUDED.is_admin,
              groups_checked_at = EXCLUDED.groups_checked_at
        RETURNING id, label, is_admin, groups_checked_at
      `,
      [randomUUID(), identity.label, identity.issuer, identity.subject, identity.role === 'admin', checkedAt],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Family player upsert returned no row');
    return fromRow(row);
  }

  async getFamilyPlayer(playerId: string): Promise<FamilyPlayerRecord | null> {
    if (!UUID.test(playerId)) return null;
    const result = await this.pool.query<PlayerRow>(
      `
        SELECT id, label, is_admin, groups_checked_at
        FROM quest_players
        WHERE id = $1 AND oidc_subject IS NOT NULL AND groups_checked_at IS NOT NULL
      `,
      [playerId],
    );
    const row = result.rows[0];
    return row ? fromRow(row) : null;
  }

  async deleteExpiredAuthRecords(now: Date): Promise<number> {
    const sessions = await this.pool.query('DELETE FROM quest_auth_sessions WHERE expires_at <= $1', [now]);
    const verifications = await this.pool.query('DELETE FROM quest_auth_verifications WHERE expires_at <= $1', [now]);
    return (sessions.rowCount ?? 0) + (verifications.rowCount ?? 0);
  }
}

interface PlayerRow {
  id: string;
  label: string;
  is_admin: boolean;
  groups_checked_at: Date;
}

function fromRow(row: PlayerRow): FamilyPlayerRecord {
  return {
    id: row.id,
    label: row.label,
    role: row.is_admin ? 'admin' : 'player',
    groupsCheckedAt: new Date(row.groups_checked_at),
  };
}

function toRecord(record: FamilyPlayerRecord): FamilyPlayerRecord {
  return {
    id: record.id,
    label: record.label,
    role: record.role,
    groupsCheckedAt: new Date(record.groupsCheckedAt),
  };
}
