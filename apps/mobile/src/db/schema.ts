import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const inspections = sqliteTable('inspections', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  blockId: text('block_id').notNull(),
  inspectorId: text('inspector_id').notNull(),
  status: text('status').notNull().default('DRAFT'),
  fruitStage: text('fruit_stage'),
  overallScore: integer('overall_score'),
  notes: text('notes'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
  reviewedById: text('reviewed_by_id'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
  fieldClocks: text('field_clocks').notNull().default('{}'),
  version: integer('version').notNull().default(1),
  serverVersion: integer('server_version'),
  syncState: text('sync_state').notNull().default('local_only'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export const observations = sqliteTable('observations', {
  id: text('id').primaryKey(),
  inspectionId: text('inspection_id').notNull(),
  kind: text('kind').notNull(),
  code: text('code').notNull(),
  severity: integer('severity'),
  count: integer('count'),
  lat: real('lat'),
  lng: real('lng'),
  accuracyM: real('accuracy_m'),
  note: text('note'),
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
  fieldClocks: text('field_clocks').notNull().default('{}'),
  version: integer('version').notNull().default(1),
  serverVersion: integer('server_version'),
  syncState: text('sync_state').notNull().default('local_only'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  observationId: text('observation_id').notNull(),
  sha256: text('sha256').notNull(),
  mime: text('mime').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  localUri: text('local_uri').notNull(),
  storageKey: text('storage_key'),
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
  lat: real('lat'),
  lng: real('lng'),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const outbox = sqliteTable('outbox', {
  mutationId: text('mutation_id').primaryKey(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  op: text('op').notNull(),
  fields: text('fields').notNull(),
  baseVersion: integer('base_version'),
  dependsOn: text('depends_on'),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const photoQueue = sqliteTable('photo_queue', {
  photoId: text('photo_id').primaryKey(),
  localUri: text('local_uri').notNull(),
  sha256: text('sha256').notNull(),
  bytes: integer('bytes').notNull(),
  state: text('state').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  farmId: text('farm_id').notNull(),
  name: text('name').notNull(),
  crop: text('crop').notNull(),
  variety: text('variety'),
  polygon: text('polygon').notNull(),
  areaHa: real('area_ha'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const farms = sqliteTable('farms', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  centroid: text('centroid').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
