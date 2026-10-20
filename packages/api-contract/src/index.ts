import { z } from 'zod';
import type { MutationFields, PushMutationResult, ChangeLogEntry } from '@fieldlog/sync-core';

export const pushRequestSchema = z.object({
  deviceId: z.string().uuid(),
  clientNow: z.string(),
  schemaVersion: z.number().int(),
  mutations: z.array(
    z.object({
      mutationId: z.string().uuid(),
      entity: z.string(),
      entityId: z.string().uuid(),
      op: z.enum(['create', 'patch', 'delete', 'transition']),
      baseVersion: z.number().int().optional(),
      fields: z.record(
        z.object({
          value: z.unknown(),
          hlc: z.string(),
        })
      ),
    })
  ),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResponseSchema = z.object({
  results: z.array(
    z.object({
      mutationId: z.string().uuid(),
      status: z.enum(['applied', 'merged', 'duplicate', 'rejected']),
      version: z.number().int().optional(),
      code: z
        .enum([
          'INSPECTION_LOCKED',
          'FORBIDDEN',
          'VALIDATION',
          'UPGRADE_REQUIRED',
          'STATE_MACHINE_VIOLATION',
        ])
        .optional(),
      message: z.string().optional(),
      serverFields: z
        .record(
          z.object({
            value: z.unknown(),
            hlc: z.string(),
          })
        )
        .optional(),
    })
  ),
});

export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullRequestSchema = z.object({
  cursor: z.union([z.string(), z.number(), z.null()]),
  limit: z.number().int().min(1).max(1000).default(500),
});

export type PullRequest = z.infer<typeof pullRequestSchema>;

export const pullResponseSchema = z.object({
  changes: z.array(
    z.object({
      seq: z.union([z.string(), z.number()]),
      entity: z.string(),
      entityId: z.string().uuid(),
      version: z.number().int(),
      op: z.enum(['create', 'update', 'delete']),
      row: z.record(z.unknown()),
      deleted: z.boolean().optional(),
      changedAt: z.union([z.string(), z.date()]),
    })
  ),
  nextCursor: z.union([z.string(), z.number(), z.null()]),
  hasMore: z.boolean(),
});

export type PullResponse = z.infer<typeof pullResponseSchema>;

export const photoUploadUrlRequestSchema = z.object({
  photoId: z.string().uuid(),
  sha256: z.string().length(64),
  mime: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type PhotoUploadUrlRequest = z.infer<typeof photoUploadUrlRequestSchema>;

export const photoUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url().optional(),
  alreadyExists: z.boolean(),
  storageKey: z.string().optional(),
});

export type PhotoUploadUrlResponse = z.infer<typeof photoUploadUrlResponseSchema>;
