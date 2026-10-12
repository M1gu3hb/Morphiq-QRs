import { z } from 'zod';
export const Roles = z.enum([
  'research',
  'web',
  'design',
  'qr',
  'mobile',
  'qa',
  'review',
  'integration',
]);
export const TaskInput = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  runId: z.string(),
  title: z.string().min(1).max(200),
  brief: z.string().min(1).max(6000),
  acceptance: z.array(z.string().max(1000)).min(1).max(15),
  files: z.array(z.string().max(240)).max(40),
  dependencies: z.array(z.string()).max(20).default([]),
  role: Roles,
  kind: z.enum(['work', 'review']).default('work'),
  targetId: z.string().optional(),
});
export type TaskSpec = z.infer<typeof TaskInput>;
export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'review'
  | 'verified'
  | 'integrated'
  | 'done'
  | 'blocked'
  | 'failed'
  | 'cancelled';
export const ReportSchema = z.object({
  status: z.enum(['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED']),
  summary: z.string().min(1).max(6000),
  files: z.array(z.string()).max(40),
  tests: z.array(z.string()).max(20),
  concerns: z.array(z.string()).max(20).default([]),
  verdict: z.enum(['pass', 'fail']).optional(),
});
export type Report = z.infer<typeof ReportSchema>;
export interface CheckEvidence {
  id: string;
  command: string;
  exitCode: number | null;
  output: string;
  startedAt: string;
  durationMs: number;
}
export interface Task extends TaskSpec {
  status: TaskStatus;
  attempts: number;
  model: string;
  createdAt: string;
  updatedAt: string;
  reason?: string;
  worktree?: string;
  base?: string;
  sessionId?: string;
  queryId?: string;
  report?: Report;
  checks: CheckEvidence[];
  diff?: string;
  commit?: string;
  ownerPid?: number;
  leaseUntil?: number;
  skill?: string;
  tool?: string;
  reviewId?: string;
}
export interface Run {
  id: string;
  objective: string;
  repo: string;
  budget: number;
  kind: 'analysis' | 'fixture' | 'product';
  status: 'queued' | 'planning' | 'running' | 'paused' | 'blocked' | 'cancelled' | 'done';
  createdAt: string;
  updatedAt: string;
  reason?: string;
  directorSession?: string;
  directorPasses: number;
  base?: string;
  commit?: string;
  authorizeProductWrite?: boolean;
}
export const RunInput = z.object({
  objective: z.string().min(4).max(8000),
  budget: z.number().positive().max(100).default(2),
  kind: z.enum(['analysis', 'fixture', 'product']).default('analysis'),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  authorizeProductWrite: z.boolean().default(false),
});
export const OfficeEvent = z.object({
  version: z.literal(1),
  id: z.number(),
  at: z.string(),
  type: z.string(),
  runId: z.string().optional(),
  taskId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});
export type Event = z.infer<typeof OfficeEvent>;
