import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import * as schema from './schema';

const sqlite = open({ name: 'fieldlog.db' });

export const db = drizzle(sqlite, { schema });

export async function initializeDatabase() {
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      inspector_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      fruit_stage TEXT,
      overall_score INTEGER,
      notes TEXT,
      started_at INTEGER NOT NULL,
      submitted_at INTEGER,
      reviewed_by_id TEXT,
      reviewed_at INTEGER,
      field_clocks TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      server_version INTEGER,
      sync_state TEXT NOT NULL DEFAULT 'local_only',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      code TEXT NOT NULL,
      severity INTEGER,
      count INTEGER,
      lat REAL,
      lng REAL,
      accuracy_m REAL,
      note TEXT,
      captured_at INTEGER NOT NULL,
      field_clocks TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      server_version INTEGER,
      sync_state TEXT NOT NULL DEFAULT 'local_only',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      mime TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      local_uri TEXT NOT NULL,
      storage_key TEXT,
      captured_at INTEGER NOT NULL,
      lat REAL,
      lng REAL,
      uploaded_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (observation_id) REFERENCES observations(id)
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS outbox (
      mutation_id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      op TEXT NOT NULL,
      fields TEXT NOT NULL,
      base_version INTEGER,
      depends_on TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS photo_queue (
      photo_id TEXT PRIMARY KEY,
      local_uri TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      name TEXT NOT NULL,
      crop TEXT NOT NULL,
      variety TEXT,
      polygon TEXT NOT NULL,
      area_ha REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      centroid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE INDEX IF NOT EXISTS idx_inspections_sync_state 
    ON inspections(sync_state);
  `);

  await sqlite.execute(`
    CREATE INDEX IF NOT EXISTS idx_outbox_status 
    ON outbox(status, next_attempt_at);
  `);
}
