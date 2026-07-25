import { z } from 'zod';

export const programSchema = z.object({
  programName: z.string().min(1, 'Program name is required'),
  tvProgramId: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  details: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  targetAudience: z.string().optional(),
  days: z.string().min(1, 'Days are required'),
  image: z.string().optional(),
  imageLandscape: z.string().optional(),
  presenter: z.string().optional(),
  type: z.string().optional(),
  thumbnail: z.string().optional(),
  isInterruptive: z.boolean().optional(),
  shouldShow: z.boolean().optional(),
});

export type ProgramFormData = z.infer<typeof programSchema>;