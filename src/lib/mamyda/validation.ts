import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const title = z.string().max(500);
const body = z.string().max(100_000);
const link = id.nullish();
const encryption = z
  .object({
    ciphertext: z.string().min(1).max(500_000),
    fingerprint: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  })
  .strict()
  .optional();
export const idInput = id;
export const clientInput = z.object({
  id: id.optional(),
  name: title.trim().min(1),
  color: z.enum(["sage", "ink", "clay", "slate", "olive"]).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  notes: body.optional(),
});
export const projectInput = z.object({
  id: id.optional(),
  clientId: id,
  name: title.trim().min(1),
  description: body.optional(),
});
export const taskInput = z.object({
  encryption,
  id: id.optional(),
  projectId: id,
  title: title.trim().min(1),
  notes: body.optional(),
  columnId: z.enum(["backlog", "this_week", "doing", "waiting", "done"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dueAt: z.iso.datetime({ offset: true }).nullish(),
  labels: z.array(z.string().max(100)).max(50).optional(),
});
export const moveInput = z.object({
  id,
  columnId: z.enum(["backlog", "this_week", "doing", "waiting", "done"]),
  position: z.number().finite(),
});
export const profileInput = z.object({
  alertEmail: z.union([z.email(), z.literal("")]).nullish(),
  alertsDueSoon: z.boolean().optional(),
  alertsOverdue: z.boolean().optional(),
  alertsMeeting: z.boolean().optional(),
  alertsEmailEnabled: z.boolean().optional(),
  alertsTelegramEnabled: z.boolean().optional(),
});
export const minuteInput = z.object({
  id: id.optional(),
  title,
  body,
  attendees: z.string().max(10_000).optional(),
  eventId: link,
  projectId: link,
});
export const noteInput = z
  .object({
    encryption,
    tags: z.array(z.string().min(1).max(100)).max(100).optional(),
    id: id.optional(),
    body,
    title: title.optional(),
    projectId: link,
  })
  .refine(
    (data) => !data.encryption || (Boolean(data.title?.trim()) && Array.isArray(data.tags)),
    "Encrypted notes require a visible title and tags",
  );
export const calendarEventWriteInput = z.object({
  sourceId: id,
  eventId: id.optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8_000),
  location: z.string().max(500),
  startsAt: z.string().min(1).max(64),
  endsAt: z.string().min(1).max(64),
  allDay: z.boolean(),
  projectId: link,
});
export const vaultInput = z.object({
  id: id.optional(),
  title,
  ciphertext: z.string().min(1).max(500_000),
});
export const keysInput = z.object({
  publicKey: z.string().min(1).max(50_000),
  privateKeyArmored: z.string().min(1).max(50_000),
});
export const polishInput = z.object({
  title,
  body: z.string().min(1).max(20_000),
  attendees: z.string().max(2000).optional(),
});
