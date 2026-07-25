import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  imageUrl: z.string().optional(),
  presenter: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  platform: z.enum(['tv', 'radio', 'both']),
  stations: z.array(z.string()).optional(),
});

export type EventFormData = z.infer<typeof eventSchema>;
