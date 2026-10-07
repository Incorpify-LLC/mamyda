import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const title = z.string().max(500);
const body = z.string().max(100_000);
const link = id.nullish();
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
});
export const minuteInput = z.object({
  id: id.optional(),
  title,
  body,
  attendees: z.string().max(10_000).optional(),
  eventId: link,
  projectId: link,
});
export const noteInput = z.object({
  id: id.optional(),
  body,
  title: title.optional(),
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
