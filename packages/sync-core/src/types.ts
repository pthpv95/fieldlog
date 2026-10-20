import { HLC } from './hlc.js';

export type MutationOp = 'create' | 'patch' | 'delete' | 'transition';

export interface MutationFields {
  [field: string]: {
    value: unknown;
    hlc: HLC | string;
  };
}

export interface OutboxMutation {
  mutationId: string;
  entity: string;
  entityId: string;
  op: MutationOp;
  fields: MutationFields;
  baseVersion?: number;
  dependsOn?: string;
  status: 'pending' | 'inflight' | 'failed' | 'dead';
  attempts: number;
  nextAttemptAt: number | null;
  lastError: string | null;
  createdAt: number;
}

export type PushResultStatus = 'applied' | 'merged' | 'duplicate' | 'rejected';

export type RejectionCode = 
  | 'INSPECTION_LOCKED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'UPGRADE_REQUIRED'
  | 'STATE_MACHINE_VIOLATION';

export interface PushMutationResult {
  mutationId: string;
  status: PushResultStatus;
  version?: number;
  code?: RejectionCode;
  message?: string;
  serverFields?: MutationFields;
}

export interface ChangeLogEntry {
  seq: string | number;
  entity: string;
  entityId: string;
  version: number;
  op: 'create' | 'update' | 'delete';
  row: Record<string, unknown>;
  deleted?: boolean;
  changedAt: string | Date;
}

export interface SyncState {
  deviceId: string;
  pullCursor: string | number | null;
  lastSuccessAt: number | null;
  schemaVersion: number;
}

export type SyncStatus = 
  | { state: 'idle' }
  | { state: 'syncing'; progress: { current: number; total: number } }
  | { state: 'success'; syncedAt: number }
  | { state: 'error'; error: string }
  | { state: 'offline' };

export type RecordSyncState = 
  | 'local_only'
  | 'synced'
  | 'pending'
  | 'conflict'
  | 'rejected';
