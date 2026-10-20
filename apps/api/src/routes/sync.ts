import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  pushRequestSchema,
  pullRequestSchema,
  type PushRequest,
  type PushResponse,
  type PullRequest,
  type PullResponse,
} from '@fieldlog/api-contract';
import { parseHLC, clampFuture, mergeField, type FieldValue } from '@fieldlog/sync-core';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SCHEMA_VERSION = 1;
const SUPPORTED_SCHEMA_VERSIONS = [1];

export async function syncRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: PushRequest }>('/push', async (request, reply) => {
    const parseResult = pushRequestSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }

    const { deviceId, clientNow, schemaVersion, mutations } = parseResult.data;

    if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
      return reply.status(400).send({
        error: 'UPGRADE_REQUIRED',
        message: `Schema version ${schemaVersion} is not supported. Please upgrade the app.`,
      });
    }

    const clientHLC = parseHLC(clientNow);
    const { clamped, wasClamped } = clampFuture(clientHLC);
    
    if (wasClamped) {
      fastify.log.warn(
        { deviceId, clientNow, clamped },
        'Clamped future HLC from device'
      );
    }

    const results: PushResponse['results'] = [];

    for (const mutation of mutations) {
      try {
        const result = await processMutation(
          deviceId,
          mutation,
          fastify.log
        );
        results.push(result);
      } catch (error) {
        fastify.log.error({ error, mutation }, 'Failed to process mutation');
        results.push({
          mutationId: mutation.mutationId,
          status: 'rejected',
          code: 'VALIDATION',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const response: PushResponse = { results };
    return reply.send(response);
  });

  fastify.post<{ Body: PullRequest }>('/pull', async (request, reply) => {
    const parseResult = pullRequestSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }

    const { cursor, limit } = parseResult.data;

    const startSeq = cursor ? BigInt(cursor) : BigInt(0);

    const changes = await prisma.changeLog.findMany({
      where: {
        seq: {
          gt: startSeq,
        },
      },
      orderBy: {
        seq: 'asc',
      },
      take: limit,
    });

    const changeEntries = await Promise.all(
      changes.map(async (change) => {
        let row: Record<string, unknown> = {};
        let deleted = false;

        switch (change.entity) {
          case 'inspection':
            const inspection = await prisma.inspection.findUnique({
              where: { id: change.entityId },
            });
            if (inspection) {
              deleted = inspection.deletedAt !== null;
              row = {
                ...inspection,
                createdAt: inspection.createdAt.toISOString(),
                updatedAt: inspection.updatedAt.toISOString(),
                startedAt: inspection.startedAt.toISOString(),
                submittedAt: inspection.submittedAt?.toISOString(),
                reviewedAt: inspection.reviewedAt?.toISOString(),
                deletedAt: inspection.deletedAt?.toISOString(),
              };
            }
            break;
          case 'observation':
            const observation = await prisma.observation.findUnique({
              where: { id: change.entityId },
            });
            if (observation) {
              deleted = observation.deletedAt !== null;
              row = {
                ...observation,
                createdAt: observation.createdAt.toISOString(),
                updatedAt: observation.updatedAt.toISOString(),
                capturedAt: observation.capturedAt.toISOString(),
                deletedAt: observation.deletedAt?.toISOString(),
              };
            }
            break;
          case 'photo':
            const photo = await prisma.photo.findUnique({
              where: { id: change.entityId },
            });
            if (photo) {
              row = {
                ...photo,
                createdAt: photo.createdAt.toISOString(),
                updatedAt: photo.updatedAt.toISOString(),
                capturedAt: photo.capturedAt.toISOString(),
                uploadedAt: photo.uploadedAt?.toISOString(),
              };
            }
            break;
        }

        return {
          seq: change.seq.toString(),
          entity: change.entity,
          entityId: change.entityId,
          version: change.version,
          op: change.op as 'create' | 'update' | 'delete',
          row,
          deleted,
          changedAt: change.changedAt.toISOString(),
        };
      })
    );

    const response: PullResponse = {
      changes: changeEntries,
      nextCursor: changes.length > 0 ? changes[changes.length - 1].seq.toString() : cursor?.toString() || null,
      hasMore: changes.length === limit,
    };

    return reply.send(response);
  });
}

async function processMutation(
  deviceId: string,
  mutation: PushRequest['mutations'][0],
  logger: any
): Promise<PushResponse['results'][0]> {
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      entity: mutation.entity,
      entityId: mutation.entityId,
      op: mutation.op,
      fields: mutation.fields,
      baseVersion: mutation.baseVersion,
    }))
    .digest('hex');

  const existingIdempotency = await prisma.idempotencyRecord.findUnique({
    where: { mutationId: mutation.mutationId },
  });

  if (existingIdempotency) {
    if (existingIdempotency.requestHash === requestHash) {
      logger.info({ mutationId: mutation.mutationId }, 'Duplicate mutation');
      return existingIdempotency.result as PushResponse['results'][0];
    } else {
      logger.warn({ mutationId: mutation.mutationId }, 'Idempotency key collision');
      return {
        mutationId: mutation.mutationId,
        status: 'rejected',
        code: 'VALIDATION',
        message: 'Idempotency key already used with different request',
      };
    }
  }

  if (mutation.entity === 'inspection' && mutation.op === 'patch') {
    return await patchInspection(deviceId, mutation, requestHash);
  }

  return {
    mutationId: mutation.mutationId,
    status: 'rejected',
    code: 'VALIDATION',
    message: `Unsupported mutation: ${mutation.entity} ${mutation.op}`,
  };
}

async function patchInspection(
  deviceId: string,
  mutation: PushRequest['mutations'][0],
  requestHash: string
): Promise<PushResponse['results'][0]> {
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${mutation.entityId.split('-')[0]}::int8)`;
    
    const inspection = await tx.inspection.findUnique({
      where: { id: mutation.entityId },
    });

    if (!inspection) {
      return {
        mutationId: mutation.mutationId,
        status: 'rejected',
        code: 'VALIDATION',
        message: 'Inspection not found',
      };
    }

    if (inspection.status === 'REVIEWED' || inspection.status === 'SUBMITTED') {
      return {
        mutationId: mutation.mutationId,
        status: 'rejected',
        code: 'INSPECTION_LOCKED',
        message: `Cannot edit inspection in ${inspection.status} status`,
      };
    }

    const serverFieldClocks = (inspection.fieldClocks as Record<string, string>) || {};
    const conflicts: Array<{
      field: string;
      winningValue: unknown;
      losingValue: unknown;
      winningHlc: string;
      losingHlc: string;
    }> = [];

    const updatedFields: Record<string, unknown> = {};
    const updatedFieldClocks: Record<string, string> = { ...serverFieldClocks };

    for (const [fieldName, fieldData] of Object.entries(mutation.fields)) {
      const clientField: FieldValue = {
        value: fieldData.value,
        hlc: fieldData.hlc,
      };

      const serverField: FieldValue | undefined = serverFieldClocks[fieldName]
        ? {
            value: (inspection as any)[fieldName],
            hlc: serverFieldClocks[fieldName],
          }
        : undefined;

      const mergeResult = mergeField(serverField, clientField, 'server', deviceId);

      if (mergeResult) {
        updatedFields[fieldName] = mergeResult.value;
        updatedFieldClocks[fieldName] = typeof mergeResult.hlc === 'string' 
          ? mergeResult.hlc 
          : `${mergeResult.hlc.logicalTime}-${mergeResult.hlc.counter}`;

        if (mergeResult.hadConflict && mergeResult.losingValue !== undefined) {
          conflicts.push({
            field: fieldName,
            winningValue: mergeResult.value,
            losingValue: mergeResult.losingValue,
            winningHlc: typeof mergeResult.hlc === 'string' 
              ? mergeResult.hlc 
              : `${mergeResult.hlc.logicalTime}-${mergeResult.hlc.counter}`,
            losingHlc: typeof mergeResult.losingHlc === 'string'
              ? mergeResult.losingHlc
              : mergeResult.losingHlc 
                ? `${mergeResult.losingHlc.logicalTime}-${mergeResult.losingHlc.counter}`
                : '',
          });
        }
      }
    }

    const newVersion = inspection.version + 1;

    await tx.inspection.update({
      where: { id: mutation.entityId },
      data: {
        ...updatedFields,
        fieldClocks: updatedFieldClocks,
        version: newVersion,
      },
    });

    await tx.changeLog.create({
      data: {
        orgId: inspection.orgId,
        entity: 'inspection',
        entityId: mutation.entityId,
        version: newVersion,
        op: 'update',
      },
    });

    for (const conflict of conflicts) {
      await tx.conflictRecord.create({
        data: {
          entity: 'inspection',
          entityId: mutation.entityId,
          field: conflict.field,
          winningValue: conflict.winningValue as any,
          losingValue: conflict.losingValue as any,
          winningHlc: conflict.winningHlc,
          losingHlc: conflict.losingHlc,
          losingDeviceId: deviceId,
        },
      });
    }

    const result: PushResponse['results'][0] = {
      mutationId: mutation.mutationId,
      status: conflicts.length > 0 ? 'merged' : 'applied',
      version: newVersion,
    };

    await tx.idempotencyRecord.create({
      data: {
        mutationId: mutation.mutationId,
        userId: inspection.inspectorId,
        deviceId,
        requestHash,
        result: result as any,
      },
    });

    return result;
  });
}
