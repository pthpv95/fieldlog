import { z } from 'zod';

export const cropTypeSchema = z.enum(['DURIAN', 'MANGO', 'DRAGON_FRUIT', 'OTHER']);
export type CropType = z.infer<typeof cropTypeSchema>;

export const blockSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  name: z.string().min(1).max(255),
  crop: cropTypeSchema,
  variety: z.string().max(255).optional(),
  polygon: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }),
  areaHa: z.number().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Block = z.infer<typeof blockSchema>;

export const createBlockSchema = blockSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateBlock = z.infer<typeof createBlockSchema>;
