import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";
async function services() {
  const { getSql } = await import("@/lib/db");
  const { requireTurnstile } = await import("./turnstile.server");
  const { createMediaService, createTranscriptionSettings } = await import("./media.server");
  const { mediaDisk } = await import("./media-storage.server");
  const sql = await getSql();
  const settings = createTranscriptionSettings(sql, requireTurnstile);
  return {
    settings,
    media: createMediaService(sql, requireTurnstile, mediaDisk, (owner) =>
      settings.credential(owner),
    ),
  };
}
export const getTranscriptionSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await services()).settings.metadata(context.userId));
export const saveTranscriptionSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => (await services()).settings.save(context.userId, data));
export const listMediaJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await services()).media.list(context.userId));
export const reserveMediaUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => (await services()).media.reserve(context.userId, data));
export const acceptMediaTranscript = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(async ({ context, data }) => (await services()).media.accept(context.userId, data));
export const discardMediaRecording = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(async ({ context, data }) => (await services()).media.discard(context.userId, data));
