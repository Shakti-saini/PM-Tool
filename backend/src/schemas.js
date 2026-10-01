import { z } from 'zod';

export const registerSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254), password: z.string().min(8).max(128) });
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
const projectBaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  startDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  members: z.array(z.string()).optional()
});
export const projectSchema = projectBaseSchema.refine(value => new Date(value.dueDate) >= new Date(value.startDate), { message: 'Project deadline must be on or after its start date', path: ['dueDate'] });
export const projectUpdateSchema = projectBaseSchema.partial().refine(v => Object.keys(v).length > 0, 'Provide at least one field');
export const taskSchema = z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().max(2000).optional(), status: z.enum(['todo', 'in-progress', 'done']).optional(), priority: z.enum(['low', 'medium', 'high']).optional(), dueDate: z.string().datetime(), assignee: z.string().nullable().optional() });
export const taskUpdateSchema = taskSchema.partial().refine(v => Object.keys(v).length > 0, 'Provide at least one field');
export const statusSchema = z.object({ status: z.enum(['todo', 'in-progress', 'done']) });
