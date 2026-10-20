import { z } from 'zod';

export const observationKindSchema = z.enum(['PEST', 'DISEASE', 'DAMAGE', 'YIELD']);
export type ObservationKind = z.infer<typeof observationKindSchema>;

export const observationSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  kind: observationKindSchema,
  code: z.string().max(50),
  severity: z.number().int().min(0).max(4).optional(),
  count: z.number().int().positive().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().positive().optional(),
  note: z.string().max(2000).optional(),
  capturedAt: z.date(),
  fieldClocks: z.record(z.string()).optional(),
  version: z.number().int().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
});
export type Observation = z.infer<typeof observationSchema>;

export const createObservationSchema = observationSchema.omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  fieldClocks: true,
}).partial({
  capturedAt: true,
});
export type CreateObservation = z.infer<typeof createObservationSchema>;

export const patchObservationSchema = observationSchema
  .omit({
    id: true,
    inspectionId: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    fieldClocks: true,
  })
  .partial();
export type PatchObservation = z.infer<typeof patchObservationSchema>;
