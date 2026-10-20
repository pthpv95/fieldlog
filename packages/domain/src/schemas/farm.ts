import { z } from 'zod';

export const farmSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1).max(255),
  centroid: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Farm = z.infer<typeof farmSchema>;

export const createFarmSchema = farmSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateFarm = z.infer<typeof createFarmSchema>;
