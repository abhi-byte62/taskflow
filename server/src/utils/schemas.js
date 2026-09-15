// Shared zod schemas — the single source of truth for API validation.
// Imported by route files; see middleware/validate.js.
const { z } = require('zod');

const idSchema = z.object({ id: z.string().min(1, 'Invalid id') });

const emailSchema = z.string().email('Invalid email address');
const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200);

// ── Auth ─────────────────────────────────────────────────────
const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Workspace ────────────────────────────────────────────────
const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(100),
  description: z.string().trim().max(500).optional(),
});

const workspaceUpdateSchema = workspaceSchema.partial();

// ── Board ────────────────────────────────────────────────────
const boardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required').max(100),
  description: z.string().trim().max(500).optional(),
  icon: z.string().max(10).optional(),
});

const boardUpdateSchema = boardSchema.partial();

// ── Column ───────────────────────────────────────────────────
const columnSchema = z.object({
  name: z.string().trim().min(1, 'Column name is required').max(100),
  position: z.number().int().optional(), // for column reordering
});

// Partial version for updates (PATCH)
const columnUpdateSchema = columnSchema.partial();

// ── Task ─────────────────────────────────────────────────────
const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const statusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: z.string().trim().max(5000).optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().nullable().optional(), // ISO date; validated/coerced in service
  columnId: z.string().min(0).optional(),
  assigneeIds: z.array(z.string()).max(20).optional(),
  labelIds: z.array(z.string()).max(20).optional(),
});

// Every update carries `version` → optimistic concurrency control.
// The client must send the version it last saw; a stale version → 409.
const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  dueDate: z.string().nullable().optional(),
  version: z.number().int().positive('version is required for updates'),
});

const moveTaskSchema = z.object({
  version: z.number().int().positive('version is required'),
  columnId: z.string().min(1, 'columnId is required'), // target column
  position: z.number().optional(), // exact float; else server places at end
  beforeTaskId: z.string().optional(), // insert before this task (gap midpoint)
});

// ── Comment ──────────────────────────────────────────────────
const commentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

// ── Pagination ───────────────────────────────────────────────
// Cursor-based: { cursor, limit } — see docs/DATABASE.md for the rationale.
const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

module.exports = {
  idSchema,
  registerSchema,
  loginSchema,
  workspaceSchema,
  workspaceUpdateSchema,
  boardSchema,
  boardUpdateSchema,
  columnSchema,
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  commentSchema,
  cursorQuerySchema,
};