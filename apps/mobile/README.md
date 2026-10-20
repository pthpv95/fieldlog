# FieldLog Mobile App

**Status:** Roadmap (Milestone 1+)

The React Native mobile app will be scaffolded in the next phase. It will include:

- **Bare React Native** app (RN CLI template with Hermes and New Architecture)
- **op-sqlite + Drizzle** for local SQLite storage
- Offline-first sync engine with outbox pattern
- **MapLibre** maps with offline tile packs
- **react-native-vision-camera** for photo capture with GPS stamps
- Background sync with **react-native-background-fetch**
- Optimistic UI with live queries
- High-contrast outdoor theme from `@fieldlog/ui-tokens`

## Architecture

The mobile app will use the shared packages:
- `@fieldlog/domain` - Zod schemas and business logic
- `@fieldlog/sync-core` - HLC, merge logic, and backoff
- `@fieldlog/api-contract` - Sync protocol types
- `@fieldlog/ui-tokens` - Design tokens

See the root README for the full offline-first sync design and roadmap.
