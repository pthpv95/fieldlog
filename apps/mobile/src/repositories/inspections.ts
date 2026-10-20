import { db } from '../db';
import { inspections, observations, outbox } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { createHLCState, tick, formatHLC, type HLCState } from '@fieldlog/sync-core';
import type { MutationFields } from '@fieldlog/sync-core';

let hlcState: HLCState = createHLCState();

export function generateUUIDv7(): string {
  const timestamp = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));
  
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-7${randomHex.slice(0, 3)}-${randomHex.slice(3, 7)}-${randomHex.slice(7, 19)}`;
}

export interface CreateInspectionInput {
  blockId: string;
  inspectorId: string;
  orgId: string;
}

export interface UpdateInspectionInput {
  id: string;
  notes?: string;
  overallScore?: number;
  fruitStage?: string;
}

export interface CreateObservationInput {
  inspectionId: string;
  kind: 'PEST' | 'DISEASE' | 'DAMAGE' | 'YIELD';
  code: string;
  severity?: number;
  count?: number;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  note?: string;
}

export async function createInspection(input: CreateInspectionInput) {
  return db.transaction(async (tx: any) => {
    const id = generateUUIDv7();
    const now = Date.now();
    const hlc = tick(hlcState);

    const inspection = {
      id,
      orgId: input.orgId,
      blockId: input.blockId,
      inspectorId: input.inspectorId,
      status: 'DRAFT',
      startedAt: new Date(now),
      fieldClocks: JSON.stringify({}),
      version: 1,
      syncState: 'local_only',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    await tx.insert(inspections).values(inspection);

    const mutationId = generateUUIDv7();
    const fields: MutationFields = {
      blockId: { value: input.blockId, hlc: formatHLC(hlc) },
      inspectorId: { value: input.inspectorId, hlc: formatHLC(hlc) },
      status: { value: 'DRAFT', hlc: formatHLC(hlc) },
      startedAt: { value: now, hlc: formatHLC(hlc) },
    };

    await tx.insert(outbox).values({
      mutationId,
      entity: 'inspection',
      entityId: id,
      op: 'create',
      fields: JSON.stringify(fields),
      status: 'pending',
      attempts: 0,
      createdAt: new Date(now),
    });

    return { id, ...inspection };
  });
}

export async function updateInspection(input: UpdateInspectionInput) {
  return db.transaction(async (tx: any) => {
    const existing = await tx
      .select()
      .from(inspections)
      .where(eq(inspections.id, input.id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Inspection not found');
    }

    const now = Date.now();
    const fields: MutationFields = {};
    const fieldClocks = JSON.parse(existing[0].fieldClocks as string);

    if (input.notes !== undefined) {
      const hlc = tick(hlcState);
      fields.notes = { value: input.notes, hlc: formatHLC(hlc) };
      fieldClocks.notes = formatHLC(hlc);
    }

    if (input.overallScore !== undefined) {
      const hlc = tick(hlcState);
      fields.overallScore = { value: input.overallScore, hlc: formatHLC(hlc) };
      fieldClocks.overallScore = formatHLC(hlc);
    }

    if (input.fruitStage !== undefined) {
      const hlc = tick(hlcState);
      fields.fruitStage = { value: input.fruitStage, hlc: formatHLC(hlc) };
      fieldClocks.fruitStage = formatHLC(hlc);
    }

    await tx
      .update(inspections)
      .set({
        notes: input.notes ?? existing[0].notes,
        overallScore: input.overallScore ?? existing[0].overallScore,
        fruitStage: input.fruitStage ?? existing[0].fruitStage,
        fieldClocks: JSON.stringify(fieldClocks),
        syncState: 'pending',
        updatedAt: new Date(now),
      })
      .where(eq(inspections.id, input.id));

    const mutationId = generateUUIDv7();
    await tx.insert(outbox).values({
      mutationId,
      entity: 'inspection',
      entityId: input.id,
      op: 'patch',
      fields: JSON.stringify(fields),
      baseVersion: existing[0].version,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(now),
    });

    return { success: true };
  });
}

export async function createObservation(input: CreateObservationInput) {
  return db.transaction(async (tx: any) => {
    const id = generateUUIDv7();
    const now = Date.now();
    const hlc = tick(hlcState);

    const observation = {
      id,
      inspectionId: input.inspectionId,
      kind: input.kind,
      code: input.code,
      severity: input.severity,
      count: input.count,
      lat: input.lat,
      lng: input.lng,
      accuracyM: input.accuracyM,
      note: input.note,
      capturedAt: new Date(now),
      fieldClocks: JSON.stringify({}),
      version: 1,
      syncState: 'local_only',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    await tx.insert(observations).values(observation);

    const mutationId = generateUUIDv7();
    const fields: MutationFields = {
      inspectionId: { value: input.inspectionId, hlc: formatHLC(hlc) },
      kind: { value: input.kind, hlc: formatHLC(hlc) },
      code: { value: input.code, hlc: formatHLC(hlc) },
    };

    if (input.severity !== undefined) {
      fields.severity = { value: input.severity, hlc: formatHLC(hlc) };
    }
    if (input.count !== undefined) {
      fields.count = { value: input.count, hlc: formatHLC(hlc) };
    }
    if (input.note !== undefined) {
      fields.note = { value: input.note, hlc: formatHLC(hlc) };
    }

    await tx.insert(outbox).values({
      mutationId,
      entity: 'observation',
      entityId: id,
      op: 'create',
      fields: JSON.stringify(fields),
      dependsOn: input.inspectionId,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(now),
    });

    return { id, ...observation };
  });
}

export async function getInspections() {
  return db.select().from(inspections).orderBy(inspections.createdAt);
}

export async function getInspection(id: string) {
  const result = await db
    .select()
    .from(inspections)
    .where(eq(inspections.id, id))
    .limit(1);
  return result[0];
}

export async function getObservationsForInspection(inspectionId: string) {
  return db
    .select()
    .from(observations)
    .where(eq(observations.inspectionId, inspectionId))
    .orderBy(observations.createdAt);
}
