import { z } from 'zod';

export const photoSchema = z.object({
  id: z.string().uuid(),
  observationId: z.string().uuid(),
  sha256: z.string().length(64),
  mime: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storageKey: z.string().optional(),
  capturedAt: z.date(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  uploadedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Photo = z.infer<typeof photoSchema>;

export const createPhotoSchema = photoSchema.omit({
  id: true,
  storageKey: true,
  uploadedAt: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  capturedAt: true,
});
export type CreatePhoto = z.infer<typeof createPhotoSchema>;
