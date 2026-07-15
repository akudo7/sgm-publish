import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

export const taskIdSchema = z.object({
  id: z.string().uuid('Invalid task ID format'),
});
