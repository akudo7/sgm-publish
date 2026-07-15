import { z } from 'zod';

export const createTaskSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(255, 'Title must be less than 255 characters'),
    description: z
      .string()
      .min(1, 'Description is required')
      .max(1000, 'Description must be less than 1000 characters'),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(255, 'Title must be less than 255 characters')
      .optional(),
    description: z
      .string()
      .min(1, 'Description cannot be empty')
      .max(1000, 'Description must be less than 1000 characters')
      .optional(),
    status: z
      .enum(['pending', 'in_progress', 'completed'])
      .optional(),
  }).refine((data) => {
    return Object.keys(data).length > 0;
  }, {
    message: 'At least one field must be provided for update',
  }),
});

export const taskIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID format'),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
