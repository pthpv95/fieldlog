import { db } from '../db';
import { outbox, inspections, syncMeta } from '../db/schema';
import { eq, and, or, lte, isNull } from 'drizzle-orm';
import {
  recordFailure,
  resetRetryState,
  isReadyToRetry,
  type RetryState,
} from '@fieldlog/sync-core';
import type {
  PushRequest,
  PushResponse,
  PullRequest,
  PullResponse,
} from '@fieldlog/api-contract';

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing'; progress: { current: number; total: number } }
  | { state: 'success'; syncedAt: number }
  | { state: 'error'; error: string }
  | { state: 'offline' };

let currentSyncStatus: SyncStatus = { state: 'idle' };
let syncInProgress = false;

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

function setSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
}

export async function sync(apiBaseUrl: string, deviceId: string, schemaVersion: number = 1) {
  if (syncInProgress) {
    return { success: false, reason: 'sync_in_progress' };
  }

  syncInProgress = true;
  setSyncStatus({ state: 'syncing', progress: { current: 0, total: 1 } });

  try {
    await pushOutbox(apiBaseUrl, deviceId, schemaVersion);

    await pullChanges(apiBaseUrl, deviceId);

    setSyncStatus({ state: 'success', syncedAt: Date.now() });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setSyncStatus({ state: 'error', error: errorMessage });
    return { success: false, reason: errorMessage };
  } finally {
    syncInProgress = false;
  }
}

async function pushOutbox(apiBaseUrl: string, deviceId: string, schemaVersion: number) {
  const now = Date.now();
  
  const pendingMutations = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.status, 'pending'),
        or(
          isNull(outbox.nextAttemptAt),
          lte(outbox.nextAttemptAt, new Date(now))
        )
      )
    )
    .orderBy(outbox.createdAt)
    .limit(50);

  if (pendingMutations.length === 0) {
    return;
  }

  setSyncStatus({
    state: 'syncing',
    progress: { current: 0, total: pendingMutations.length },
  });

  const mutations = pendingMutations.map((m: any) => ({
    mutationId: m.mutationId,
    entity: m.entity,
    entityId: m.entityId,
    op: m.op as 'create' | 'patch' | 'delete' | 'transition',
    baseVersion: m.baseVersion || undefined,
    fields: JSON.parse(m.fields),
  }));

  const pushRequest: PushRequest = {
    deviceId,
    clientNow: `${Date.now()}-0`,
    schemaVersion,
    mutations,
  };

  for (const mutation of mutations) {
    await db.update(outbox).set({ status: 'inflight' }).where(
      eq(outbox.mutationId, mutation.mutationId)
    );
  }

  const response = await fetch(`${apiBaseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pushRequest),
  });

  if (!response.ok) {
    for (const mutation of mutations) {
      const retryState: RetryState = {
        attempts: pendingMutations.find((m: any) => m.mutationId === mutation.mutationId)!.attempts,
        nextAttemptAt: null,
        lastError: null,
      };
      const newState = recordFailure(retryState, `HTTP ${response.status}`);
      
      await db
        .update(outbox)
        .set({
          status: newState.nextAttemptAt ? 'pending' : 'dead',
          attempts: newState.attempts,
          nextAttemptAt: newState.nextAttemptAt ? new Date(newState.nextAttemptAt) : null,
          lastError: newState.lastError,
        })
        .where(eq(outbox.mutationId, mutation.mutationId));
    }
    throw new Error(`Push failed: ${response.status}`);
  }

  const pushResponse: PushResponse = await response.json();

  for (const result of pushResponse.results) {
    if (result.status === 'applied' || result.status === 'merged' || result.status === 'duplicate') {
      await db.delete(outbox).where(eq(outbox.mutationId, result.mutationId));
      
      const mutation = mutations.find((m: any) => m.mutationId === result.mutationId);
      if (mutation && result.version) {
        if (mutation.entity === 'inspection') {
          await db
            .update(inspections)
            .set({
              serverVersion: result.version,
              syncState: 'synced',
            })
            .where(eq(inspections.id, mutation.entityId));
        }
      }
    } else if (result.status === 'rejected') {
      await db
        .update(outbox)
        .set({
          status: 'dead',
          lastError: result.message || result.code,
        })
        .where(eq(outbox.mutationId, result.mutationId));

      if (result.code === 'INSPECTION_LOCKED' || result.code === 'FORBIDDEN') {
        const mutation = mutations.find((m: any) => m.mutationId === result.mutationId);
        if (mutation && mutation.entity === 'inspection') {
          await db
            .update(inspections)
            .set({ syncState: 'rejected' })
            .where(eq(inspections.id, mutation.entityId));
        }
      }
    }
  }
}

async function pullChanges(apiBaseUrl: string, deviceId: string) {
  let cursor: string | number | null = null;
  
  const cursorResult = await db.select().from(syncMeta).where(eq(syncMeta.key, `pull_cursor_${deviceId}`)).limit(1);
  if (cursorResult.length > 0) {
    cursor = cursorResult[0].value ? JSON.parse(cursorResult[0].value) : null;
  }
  
  let hasMore = true;

  while (hasMore) {
    const pullRequest: PullRequest = {
      cursor,
      limit: 500,
    };

    const response = await fetch(`${apiBaseUrl}/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pullRequest),
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status}`);
    }

    const pullResponse: PullResponse = await response.json();

    await db.transaction(async (tx: any) => {
      for (const change of pullResponse.changes) {
        if (change.entity === 'inspection') {
          const hasPendingChanges = await tx
            .select()
            .from(outbox)
            .where(
              and(
                eq(outbox.entity, 'inspection'),
                eq(outbox.entityId, change.entityId),
                eq(outbox.status, 'pending')
              )
            )
            .limit(1);

          if (hasPendingChanges.length === 0) {
            await tx
              .insert(inspections)
              .values({
                id: change.row.id as string,
                orgId: change.row.orgId as string,
                blockId: change.row.blockId as string,
                inspectorId: change.row.inspectorId as string,
                status: change.row.status as string,
                fruitStage: change.row.fruitStage as string | null,
                overallScore: change.row.overallScore as number | null,
                notes: change.row.notes as string | null,
                startedAt: new Date(change.row.startedAt as string),
                submittedAt: change.row.submittedAt ? new Date(change.row.submittedAt as string) : null,
                reviewedById: change.row.reviewedById as string | null,
                reviewedAt: change.row.reviewedAt ? new Date(change.row.reviewedAt as string) : null,
                fieldClocks: JSON.stringify(change.row.fieldClocks || {}),
                version: change.version,
                serverVersion: change.version,
                syncState: 'synced',
                createdAt: new Date(change.row.createdAt as string),
                updatedAt: new Date(change.row.updatedAt as string),
                deletedAt: change.row.deletedAt ? new Date(change.row.deletedAt as string) : null,
              })
              .onConflictDoUpdate({
                target: inspections.id,
                set: {
                  status: change.row.status as string,
                  notes: change.row.notes as string | null,
                  overallScore: change.row.overallScore as number | null,
                  fruitStage: change.row.fruitStage as string | null,
                  serverVersion: change.version,
                  syncState: 'synced',
                  updatedAt: new Date(change.row.updatedAt as string),
                },
              });
          }
        }
      }

      await tx
        .insert(syncMeta)
        .values({
          key: `pull_cursor_${deviceId}`,
          value: JSON.stringify(pullResponse.nextCursor),
          updatedAt: new Date(Date.now()),
        })
        .onConflictDoUpdate({
          target: syncMeta.key,
          set: {
            value: JSON.stringify(pullResponse.nextCursor),
            updatedAt: new Date(Date.now()),
          },
        });
    });

    cursor = pullResponse.nextCursor;
    hasMore = pullResponse.hasMore;
  }
}
