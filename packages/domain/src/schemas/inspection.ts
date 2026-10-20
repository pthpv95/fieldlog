import { z } from 'zod';

export const inspectionStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'REVIEWED', 'REOPENED']);
export type InspectionStatus = z.infer<typeof inspectionStatusSchema>;

export const fruitStageSchema = z.enum(['FLOWERING', 'FRUIT_SET', 'DEVELOPING', 'MATURE', 'HARVEST_READY']);
export type FruitStage = z.infer<typeof fruitStageSchema>;

export const inspectionSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  blockId: z.string().uuid(),
  inspectorId: z.string().uuid(),
  status: inspectionStatusSchema,
  fruitStage: fruitStageSchema.optional(),
  overallScore: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  startedAt: z.date(),
  submittedAt: z.date().optional(),
  reviewedById: z.string().uuid().optional(),
  reviewedAt: z.date().optional(),
  fieldClocks: z.record(z.string()).optional(),
  version: z.number().int().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
});
export type Inspection = z.infer<typeof inspectionSchema>;

export const createInspectionSchema = inspectionSchema.omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  fieldClocks: true,
}).partial({
  status: true,
  startedAt: true,
});
export type CreateInspection = z.infer<typeof createInspectionSchema>;

export const patchInspectionSchema = inspectionSchema
  .omit({
    id: true,
    orgId: true,
    blockId: true,
    inspectorId: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    fieldClocks: true,
  })
  .partial();
export type PatchInspection = z.infer<typeof patchInspectionSchema>;
