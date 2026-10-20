# FieldLog

**Offline-first orchard inspection app** – A portfolio project by Hien Pham demonstrating advanced React Native, TypeScript, and sync architecture skills.

[![CI](https://github.com/placeholder/fieldlog/workflows/CI/badge.svg)](https://github.com/placeholder/fieldlog/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> **Status:** Milestone 0/1 foundation complete. This is a work-in-progress portfolio project, not production software.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Offline-First Sync Design](#offline-first-sync-design)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)
- [Design Decisions](#design-decisions)
- [License](#license)

---

## Overview

FieldLog enables agricultural inspectors to record orchard inspections (pests, diseases, yield estimates) **completely offline** in areas with poor or no cellular signal, then sync when connectivity returns. The system demonstrates:

- **Offline-first mobile architecture** with local SQLite, transactional outbox, and background sync
- **Per-field conflict resolution** using Hybrid Logical Clocks (HLC) and last-writer-wins
- **Idempotent sync protocol** with change-log cursor-based pull
- **Monorepo** sharing TypeScript domain models, validation, and business logic across mobile, web, and API
- **Production-grade tooling**: Prisma migrations, Docker Compose, CI with tests, conflict logging

**Why this project?**  
This project targets a Senior Full-Stack Mobile Engineer role building offline-first agricultural field apps. It demonstrates the exact stack from the job description: React Native (bare), MapLibre, oRPC, Prisma, PostgreSQL, Zod, and TanStack.

---

## Architecture

```mermaid
flowchart LR
  subgraph Mobile["apps/mobile: React Native (Roadmap)"]
    UI["Screens<br/>(map, inspection, camera)"]
    Repo["Repositories<br/>(Drizzle on op-sqlite)"]
    DB[("SQLite<br/>entities + outbox<br/>+ photo_queue")]
    Engine["Sync engine<br/>HLC, merge, backoff"]
    Triggers["Triggers: NetInfo,<br/>BackgroundFetch"]
  end

  subgraph Shared["packages/* (shared TypeScript domain)"]
    Domain["domain: Zod schemas,<br/>state machine, RBAC"]
    SyncCore["sync-core: HLC, merge,<br/>backoff (pure, tested)"]
    Contract["api-contract: sync I/O types"]
  end

  subgraph API["apps/api: Fastify + oRPC"]
    Push["sync/push<br/>idempotency + LWW merge"]
    Pull["sync/pull<br/>change-log cursor"]
  end

  PG[("PostgreSQL<br/>entities, change_log,<br/>idempotency, conflicts")]
  S3[("S3 / MinIO<br/>photos")]

  subgraph Web["apps/web: React + Vite"]
    WebUI["Supervisor dashboard<br/>(inspections, conflicts)"]
  end

  Engine -- "push" --> Push
  Engine -- "pull" --> Pull
  Engine -- "photo PUT" --> S3
  WebUI -- "API" --> API
  Push --> PG
  Pull --> PG
  
  Mobile -.uses.-> Shared
  API -.uses.-> Shared
  Web -.uses.-> Shared
```

### Monorepo Layout

```
apps/
  mobile/        React Native app (roadmap - milestone 1+)
  api/           Fastify + sync endpoints + Prisma
  web/           React supervisor dashboard (Vite)

packages/
  domain/        Zod schemas, state machine, RBAC rules
  sync-core/     HLC, merge, backoff (pure TS, unit tested)
  api-contract/  Push/pull request/response types
  db/            Prisma schema + migrations + seed
  ui-tokens/     High-contrast design tokens

infra/
  docker-compose.yml  Postgres 16 + MinIO

.github/workflows/
  ci.yml         Lint, typecheck, unit tests, integration tests
```

**"Write each rule once"**: The inspection state machine (`DRAFT → SUBMITTED → REVIEWED → REOPENED`), permission checks, and the HLC-based `merge()` function live in `packages/*` and are used by mobile (optimistic validation), API (enforcement), and web (UI state).

---

## Offline-First Sync Design

### Key Concepts

1. **Local-first writes**: Every user action writes to the local SQLite database **immediately** in a transaction. The UI never blocks on network. An **outbox** table captures mutations with idempotency keys (UUIDv7).

2. **Hybrid Logical Clocks (HLC)**: Each field update carries an HLC timestamp (format: `logicalTime-counter`). HLCs provide a total order even when device clocks are wrong, enabling deterministic conflict resolution.

3. **Per-field last-writer-wins (LWW)**: When the same field is edited offline on two devices, the field with the higher HLC wins. The losing value is logged in a `conflict_records` table visible to supervisors.

4. **Idempotent push**: Each mutation has a unique `mutationId` (UUIDv7). The server deduplicates using an `idempotency_records` table. If the device retries a mutation (network error, app kill), the server returns the cached result.

5. **Change-log pull**: The server writes every entity change to a `change_log` table with an auto-incrementing `seq`. Clients pull with a cursor (`?cursor=12345&limit=500`), applying changes in order. The server uses a per-org advisory lock during writes to prevent out-of-order sequence commits.

6. **Conflict resolution during pull**: When pulling changes, if the entity has pending local edits, the device runs `merge()` to combine server fields and local fields, keeping the higher HLC per field. This prevents server data from clobbering unpushed edits.

### Sync Cycle

```
1. Push outbox → server applies mutations idempotently, returning per-mutation results
2. Pull changes since cursor → server returns entity snapshots with version
3. Merge pulled data with local pending edits (if any) using HLC
4. Save new cursor and sync status
```

### Failure Handling

| Failure | Behavior |
|---------|----------|
| Network error, 5xx, 429 | Retry with **exponential backoff + full jitter** (2s base, 10min cap). Safe due to idempotency keys. |
| 401 (token expired) | Refresh token, retry. If refresh fails after days offline, keep all local data and prompt re-login. **Never wipe**. |
| `rejected` (validation, locked) | Mark mutation `dead`, flag record as `rejected` in UI "Needs attention" list, send Sentry event. |
| App killed mid-sync | `inflight` outbox rows revert to `pending` on next launch. Idempotency makes resend safe. |
| Clock drift (device time wrong) | Server clamps HLCs > 5 min in the future, logs the event. |

### Why Not a CRDT?

CRDTs (Automerge, Yjs) shine for **concurrent collaborative text editing**. In FieldLog:
- Inspections have **one owner** (the inspector who created them)
- Edits rarely overlap (inspectors work on different blocks)
- We need **SQL queryability** (Prisma queries, not CRDT state)
- Supervisors need to **see conflicts** (review both values, not silent merge)

Per-field LWW with HLC is simpler, faster, and meets the requirements. When would a CRDT help? If multiple supervisors collaboratively edited the same inspection's long-form notes in real time.

---

## Technology Stack

### Core

- **TypeScript** monorepo (pnpm workspaces)
- **Zod** for schemas and validation
- **Prisma** + **PostgreSQL** for the server database
- **Fastify** for the Node.js API
- **Vitest** for unit and integration tests

### Mobile

- **React Native** with TypeScript
- **op-sqlite** + **Drizzle** for local SQLite (implemented)
- **Outbox pattern** with idempotency keys (implemented)
- **Sync client** with push/pull (implemented)
- **Inspection list and form screens** (implemented)
- **Sync status indicators** (implemented)
- **MapLibre** for offline maps (roadmap)
- **react-native-vision-camera** for photos (roadmap)
- **react-native-background-fetch** for background sync (roadmap)
- **expo-updates** for OTA updates (roadmap)

### Web

- **React 18** + **Vite** for the supervisor dashboard
- **@fieldlog/ui-tokens** for shared high-contrast design tokens

### Infrastructure

- **Docker Compose** (Postgres + MinIO for photo storage)
- **GitHub Actions** CI (lint, typecheck, tests)

---

## Getting Started

### Prerequisites

- **Node.js** 22+
- **pnpm** 12+ (`corepack enable`)
- **Docker** and Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/placeholder/fieldlog.git
cd fieldlog

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Start infrastructure (Postgres + MinIO)
cd infra
docker compose up -d
cd ..

# Generate Prisma client
cd packages/db
pnpm generate

# Run migrations
pnpm migrate

# Seed demo data (org, users, farm, blocks)
pnpm seed
```

### Running the API

```bash
# From root
pnpm dev:api

# API will be available at http://localhost:3001
# Health check: curl http://localhost:3001/health
```

### Running the Web Dashboard

```bash
# From root
pnpm dev:web

# Web dashboard will be available at http://localhost:3000
```

### Running Tests

```bash
# All tests
pnpm test

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

---

## Project Structure

```
packages/
  domain/
    src/
      schemas/      # Zod schemas for User, Farm, Block, Inspection, Observation, Photo
      state-machine.ts   # Inspection status transitions
      permissions.ts     # RBAC rules (canEditInspection, etc.)
  
  sync-core/
    src/
      hlc.ts        # Hybrid Logical Clock implementation
      merge.ts      # Per-field LWW merge logic
      backoff.ts    # Exponential backoff with full jitter
      types.ts      # OutboxMutation, ChangeLogEntry, SyncState
    test/           # Comprehensive unit tests (HLC, merge, backoff)
  
  api-contract/
    src/
      index.ts      # Push/pull request/response schemas
  
  db/
    schema.prisma   # Postgres schema (orgs, users, farms, blocks, inspections, 
                    #   observations, photos, change_log, idempotency_records, 
                    #   conflict_records)
    seed.ts         # Demo data: 1 org, 3 users, 1 farm, 3 blocks
  
  ui-tokens/
    src/
      index.ts      # High-contrast colors, touch targets (48/56/64dp), spacing

apps/
  api/
    src/
      routes/
        sync.ts     # POST /sync/push, POST /sync/pull
        health.ts   # GET /health
      index.ts      # Fastify server
  
  web/
    src/
      App.tsx       # Supervisor dashboard (placeholder with status cards)
  
  mobile/
    src/
      db/
        schema.ts       # Drizzle schema (inspections, observations, outbox)
        index.ts        # Database initialization
      repositories/
        inspections.ts  # Local-first CRUD with outbox pattern
      sync/
        client.ts       # Push/pull sync client
      screens/
        InspectionListScreen.tsx    # List with sync status
        InspectionFormScreen.tsx    # Create/edit + observations
      App.tsx           # Main app with navigation
    __tests__/          # Unit tests for repositories and sync
    package.json        # React Native + op-sqlite + Drizzle
```

---

## Development

### Database Migrations

```bash
cd packages/db

# Create a new migration
pnpm prisma migrate dev --name add_new_field

# Apply migrations in production
pnpm migrate:deploy

# Open Prisma Studio to inspect data
pnpm studio
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://fieldlog:fieldlog_dev@localhost:5432/fieldlog

MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=fieldlog
MINIO_SECRET_KEY=fieldlog_dev
MINIO_BUCKET=fieldlog-photos

PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info
```

---

## Roadmap

### ✅ Milestone 0/1: Foundation + Mobile Core (This PR)

- [x] TypeScript monorepo (pnpm workspaces)
- [x] `packages/domain`: Zod schemas for orchard entities
- [x] `packages/sync-core`: HLC, merge, backoff with unit tests
- [x] `packages/api-contract`: Push/pull types
- [x] `packages/db`: Prisma schema with change_log, idempotency, conflicts
- [x] `packages/ui-tokens`: High-contrast design tokens
- [x] `apps/api`: Fastify server with `/sync/push` and `/sync/pull` endpoints
- [x] `apps/web`: React dashboard placeholder
- [x] Docker Compose (Postgres + MinIO)
- [x] GitHub Actions CI (lint, typecheck, unit tests)
- [x] Comprehensive README with architecture diagram
- [x] **React Native app** with TypeScript
- [x] **op-sqlite + Drizzle** local schema mirroring Prisma
- [x] **Outbox table** with idempotency keys (UUIDv7)
- [x] **Local repositories**: write = entity + outbox in one transaction
- [x] **Sync client**: push/pull using `@fieldlog/sync-core` and `@fieldlog/api-contract`
- [x] **Inspection list screen** with sync status pill and record badges
- [x] **Inspection form screen** with create/edit and observations
- [x] **Unit tests** for repositories and sync client
- [x] Local-first: all writes save immediately, sync happens in background

### ○ Milestone 2: Enhanced Sync Features (Next)

- [ ] Sync triggers: NetInfo, AppState, debounced write
- [ ] React Native BackgroundFetch integration
- [ ] "Needs attention" screen for rejected mutations
- [ ] Conflict merging on pull when local pending changes exist
- [ ] Token refresh handling

### ○ Milestone 3: Maps & GPS

- [ ] MapLibre map with GeoJSON block polygons
- [ ] Offline tile pack for demo farm (Bangkok area)
- [ ] Tap block → start inspection
- [ ] GPS-stamped observations with accuracy indicator
- [ ] Location permissions and error handling

### ○ Milestone 4: Camera & Photos

- [ ] react-native-vision-camera integration
- [ ] Photo resize → sha256 → photo_queue table
- [ ] Presigned upload to MinIO
- [ ] Dedupe on sha256 (skip upload if already exists)
- [ ] Photo upload pause on battery saver (DeviceHealth module)

### ○ Milestone 5: Background Sync & Sentry

- [ ] react-native-background-fetch (iOS BGTaskScheduler, Android JobScheduler)
- [ ] Offline-safe token refresh (keep data if refresh token expires)
- [ ] Sentry integration with source maps, release/dist, OTA update ID
- [ ] Sync breadcrumbs and error reporting

### ○ Milestone 6: Detox E2E Tests

- [ ] Detox setup with network gate toggle
- [ ] E2E scenarios: offline create → sync, kill mid-sync, conflict, locked edit, long offline
- [ ] Android emulator job in GitHub Actions

### ○ Milestone 7: Web Features

- [ ] Inspections table with filters (status, inspector, date range)
- [ ] Inspection detail view with observations and photos
- [ ] Review / approve / reopen actions
- [ ] Conflict log viewer (winning vs. losing values with HLCs)
- [ ] MapLibre GL JS map showing inspection pins

### ○ Milestone 8: Release Pipeline

- [ ] Fastlane lanes for Android (Play internal testing) and iOS (TestFlight)
- [ ] expo-updates channels (preview / production) with runtimeVersion
- [ ] OTA publish on merge to main (when native fingerprint unchanged)
- [ ] Release workflow in GitHub Actions
- [ ] Sentry source map / dSYM upload

### ○ Stretch Goals (If Time Permits)

- [ ] TanStack Start migration for web (server-side rendering)
- [ ] TanStack Query for API calls
- [ ] Microsoft Entra ID SSO
- [ ] Vietnamese/English i18n
- [ ] Toxiproxy for flaky network integration tests
- [ ] Automerge experiment for collaborative notes (with ADR explaining when CRDT is worth it)

---

## Design Decisions

### Why op-sqlite + Drizzle Instead of WatermelonDB?

**WatermelonDB** has built-in sync primitives and lazy loading, which is great for large datasets. However:
- Its conflict model is **per-record** (not per-field), which doesn't match our requirements
- We want to demonstrate **custom outbox and conflict resolution** (the core of the portfolio project)
- Drizzle provides a typed schema and works with op-sqlite's JSI bindings (fast on low-end Android)

If we were building this for production with a team, WatermelonDB's opinionated sync would save engineering time. For this portfolio, a custom outbox shows deeper understanding.

### Why Per-Field LWW and Not Operational Transformation?

**Operational Transformation (OT)** and **CRDTs** are powerful for real-time collaborative text editing (Google Docs, Figma). FieldLog's inspections:
- Are owned by one inspector
- Have structured fields (dropdowns, numbers, short text), not long-form documents
- Are edited sequentially (inspector finishes, then supervisor reviews)
- Need SQL queryability and server-side validation

Per-field LWW is simpler, performant, and sufficient. The conflict log makes conflicts **visible** (a feature, not a bug) so supervisors can review both values.

### Why Change-Log Cursor Instead of Timestamp-Based Sync?

Using `updatedAt > lastPullTime` has a subtle bug: clock skew on the server or clients can cause changes to be skipped. A **monotonic sequence** (`change_log.seq bigserial`) guarantees no change is missed. The per-org advisory lock ensures writes are serialized per organization, so seq commits in order.

Alternative: PostgreSQL logical replication (more complex but scales better). For this project's scope, change_log + advisory lock is pragmatic.

### Why Fastify Instead of Express?

**Fastify** has:
- Built-in schema validation (we use Zod, but Fastify's design encourages it)
- Better TypeScript support
- Faster performance (though not critical at this scale)
- oRPC has a Fastify adapter (matches the job description stack)

### Why Not TanStack Start for Web?

**TanStack Start** (React 19 + server-side rendering) is listed in the job description and is a roadmap item. For the **Milestone 0 scaffold**, a simpler **React + Vite** setup demonstrates the supervisor dashboard concept without adding SSR complexity. The plan is to migrate to TanStack Start + TanStack Query in Milestone 7.

---

## Known Limitations

This is a **portfolio project** to demonstrate offline-first mobile architecture, not production software:

- **Native builds not in CI**: React Native iOS/Android builds require Xcode/Android Studio, not included in GitHub Actions (lint/typecheck/test are)
- **Single organization**: No multi-tenant admin
- **No authentication yet**: JWT auth + optional Entra ID SSO are roadmap items
- **Simplified RBAC**: Permission checks are implemented but not enforced end-to-end yet
- **No offline web**: Only the mobile app works offline
- **Demo data only**: Seed script provides one farm with three blocks, mobile app uses hardcoded IDs
- **No tile pack management**: Offline map tiles (MapLibre) are a roadmap item
- **Photo storage**: MinIO (S3-compatible) is used; production would use AWS S3 or GCS
- **Camera + GPS**: Photo capture and GPS-stamping are roadmap items
- **Pull-side conflict merging**: When pulling changes, if local has pending edits, they should be merged field-by-field; currently we skip the row entirely (roadmap)
- **Change-log advisory lock**: Currently uses advisory lock per entity ID hash; production should use per-org lock to guarantee ordering

---

## Contributing

This is a personal portfolio project by Hien Pham. Suggestions and feedback are welcome via issues, but contributions are not being accepted at this time.

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Contact

**Hien Pham**  
Portfolio project for Senior Full-Stack Mobile Engineer role  
GitHub: [@placeholder](https://github.com/placeholder)

---

**Built with:** React Native (roadmap), TypeScript, Fastify, Prisma, PostgreSQL, MapLibre (roadmap), Zod, Vitest, Docker, GitHub Actions
