import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { eq } from 'drizzle-orm';
import { createHLCState, type HLCState } from '@fieldlog/sync-core';
import * as schema from './schema';

const sqlite = open({ 
  name: 'fieldlog.db',
});

sqlite.execute('PRAGMA journal_mode = WAL;');
sqlite.execute('PRAGMA synchronous = NORMAL;');
sqlite.execute('PRAGMA foreign_keys = ON;');
sqlite.execute('PRAGMA busy_timeout = 5000;');

export const db = drizzle(sqlite, { schema });

const CURRENT_SCHEMA_VERSION = 1;

let hlcState: HLCState = createHLCState();

export function getHLCState(): HLCState {
  return hlcState;
}

export async function initializeDatabase() {
  const versionResult = sqlite.execute('PRAGMA user_version;');
  const currentVersion = versionResult.rows?._array?.[0]?.user_version || 0;

  if (currentVersion === 0) {
    await runMigrationV1();
  }

  await loadHLCState();
}

async function runMigrationV1() {
  await sqlite.execute(`
    CREATE TABLE inspections (
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
    CREATE TABLE observations (
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
    CREATE TABLE photos (
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
    CREATE TABLE outbox (
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
    CREATE TABLE photo_queue (
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
    CREATE TABLE sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE TABLE blocks (
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
    CREATE TABLE farms (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      centroid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await sqlite.execute(`
    CREATE INDEX idx_inspections_sync_state 
    ON inspections(sync_state);
  `);

  await sqlite.execute(`
    CREATE INDEX idx_outbox_status 
    ON outbox(status, next_attempt_at);
  `);

  await sqlite.execute('PRAGMA user_version = 1;');
}

async function loadHLCState() {
  const result = await db.select().from(schema.syncMeta).where(eq(schema.syncMeta.key, 'hlc_state')).limit(1);
  if (result.length > 0 && result[0].value) {
    const saved = JSON.parse(result[0].value);
    hlcState.logicalTime = saved.logicalTime || 0;
    hlcState.counter = saved.counter || 0;
  }
}

export async function saveHLCState() {
  await db
    .insert(schema.syncMeta)
    .values({
      key: 'hlc_state',
      value: JSON.stringify(hlcState),
      updatedAt: new Date(Date.now()),
    })
    .onConflictDoUpdate({
      target: schema.syncMeta.key,
      set: {
        value: JSON.stringify(hlcState),
        updatedAt: new Date(Date.now()),
      },
    });
}
