# Code Review Fixes - October 2026

This document tracks the issues found in code review and their resolutions.

## ✅ Fixed Issues

### 1. Outbox Selection with NULL
**Issue**: `eq(nextAttemptAt, null)` in SQL never returns true because `= NULL` is always false.

**Fix**: Changed to use `isNull(outbox.nextAttemptAt)` or `lte(outbox.nextAttemptAt, now)` for proper NULL handling.

**Location**: `apps/mobile/src/sync/client.ts`

**Test**: Manual verification - new outbox rows now sync correctly.

---

### 2. HLC Tie-Break
**Issue**: When two HLCs are equal, `mergeField` kept the local value arbitrarily, causing server and device to diverge.

**Fix**: Added deterministic device-id tie-break. When HLCs are equal, the device with lexicographically smaller ID wins.

**Location**: `packages/sync-core/src/merge.ts`

**Test**: `packages/sync-core/test/merge-tiebreak.test.ts` - 2 new tests verify tie-breaking is deterministic and convergent.

---

### 3. HLC State Persistence
**Issue**: HLC state lived only in memory, causing clock regression across app restarts.

**Fix**: 
- HLC state now saved to `sync_meta` table on every mutation
- Loaded from `sync_meta` on app init
- Ensures monotonicity across restarts

**Location**: `apps/mobile/src/db/index.ts`, `apps/mobile/src/repositories/inspections.ts`

**Test**: Manual verification - HLC counter persists across app restarts.

---

### 4. Pull Cursor Persistence
**Issue**: Pull cursor wasn't saved, and pulled pages weren't applied in the same transaction as cursor update.

**Fix**:
- Pull cursor now saved to `sync_meta` per device
- Cursor load, change application, and cursor save all happen in one `db.transaction`
- Prevents partial page application

**Location**: `apps/mobile/src/sync/client.ts`

**Test**: Manual verification - pull resumes from correct cursor after restart.

---

### 5. Outbox Inflight Marking
**Issue**: Only the first outbox row in a batch was marked `inflight`, others stayed `pending`.

**Fix**: Loop through all mutations in batch and mark each as `inflight` before sending request.

**Location**: `apps/mobile/src/sync/client.ts`

**Test**: Manual verification - all mutations in batch transition to `inflight` state.

---

### 6. SQLite PRAGMAs
**Issue**: No connection PRAGMAs set on open.

**Fix**: Set on every connection open:
- `PRAGMA journal_mode = WAL` (write-ahead logging for concurrency)
- `PRAGMA synchronous = NORMAL` (balance durability vs. performance)
- `PRAGMA foreign_keys = ON` (enforce referential integrity)
- `PRAGMA busy_timeout = 5000` (wait 5s instead of failing immediately)

**Location**: `apps/mobile/src/db/index.ts`

**Test**: PRAGMAs verified via `sqlite.execute('PRAGMA journal_mode;')` etc.

---

### 7. Schema Migrations
**Issue**: Tables created with `CREATE TABLE IF NOT EXISTS`, no versioning.

**Fix**:
- Replaced with forward-only migration system using `PRAGMA user_version`
- `runMigrationV1()` creates all tables (no IF NOT EXISTS)
- Future migrations check `user_version` and apply only missing versions
- Version bumped to 1 after migration

**Location**: `apps/mobile/src/db/index.ts`

**Test**: Fresh install creates schema v1. Future installs will skip v1 if already applied.

---

### 8. Server-Side Concurrency
**Issue**: Request hash only covered `fields`, and no locking around `change_log` insert.

**Fix**:
- Request hash now includes `entity`, `entityId`, `op`, `fields`, and `baseVersion`
- Added PostgreSQL advisory lock per entity ID: `pg_advisory_xact_lock(entity_id_hash)` at start of transaction
- Ensures change_log seq ordering is deterministic under concurrent writes

**Location**: `apps/api/src/routes/sync.ts`

**Test**: Concurrent push requests to same entity now serialize correctly.

---

### 9. UUIDv7 Variant Bits
**Issue**: UUIDv7 generator didn't set RFC 4122 variant and version bits.

**Fix**:
- Set version bits: `randomBytes[0] = (randomBytes[0] & 0x0f) | 0x70` (version 7)
- Set variant bits: `randomBytes[2] = (randomBytes[2] & 0x3f) | 0x80` (RFC 4122 variant)

**Location**: `apps/mobile/src/repositories/inspections.ts`

**Test**: `packages/sync-core/test/uuidv7.test.ts` - 2 new tests verify version=7 and variant=2 (RFC 4122).

---

## ⚠️ False Alarms / Partial Issues

None - all 9 issues were confirmed and fixed.

---

## 📊 Test Results

**Before fixes**: 44 tests passing  
**After fixes**: 48 tests passing (+4 new tests for tie-break and UUIDv7)

All tests pass:
```
Test Files  5 passed (5)
     Tests  48 passed (48)
```

---

## 🔄 Remaining Known Issues (Roadmap)

1. **Pull-side merge**: When pulling changes, if local entity has pending edits, should merge field-by-field using HLC. Currently skips the row entirely if pending changes exist.

2. **Advisory lock scope**: Currently locks per entity ID hash. Production should lock per-org to guarantee total ordering of change_log across all entities in an org.

3. **Sync triggers**: Auto-sync on NetInfo, AppState, BackgroundFetch not yet implemented (manual sync only).

4. **Token refresh**: Offline token refresh handling not yet implemented.

These are documented in the roadmap (Milestone 2+).
