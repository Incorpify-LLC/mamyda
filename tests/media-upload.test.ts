import { beforeAll, afterAll, beforeEach, test, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Sql } from "@/lib/db";
import { createMediaService, createTranscriptionSettings } from "@/lib/mamyda/media.server";
let db: PGlite, sql: Sql;
const guard = vi.fn(async () => {}),
  put = vi.fn(async () => {}),
  remove = vi.fn(async () => {});
const credential = vi.fn(async () => ({ model: "gpt-transcribe", cipher: "protected-key" }));
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("migrations/0012_recordings.sql", "utf8"));
  sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        args,
      )
    ).rows) as Sql;
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("truncate media_jobs");
  vi.clearAllMocks();
});
async function* bytes(size: number) {
  yield new Uint8Array(size);
}
test("recordings require consent, reject oversize/unsupported files and isolate owners", async () => {
  const api = createMediaService(sql, guard, { putChunk: put, remove }, credential);
  await expect(
    api.reserve("alice", { name: "audio.mp3", size: 10, consent: false }),
  ).rejects.toThrow();
  await expect(
    api.reserve("alice", { name: "audio.mp3", size: 300 * 1024 * 1024 + 1, consent: true }),
  ).rejects.toThrow();
  await expect(
    api.reserve("alice", { name: "audio.exe", size: 10, consent: true }),
  ).rejects.toThrow();
  const row = await api.reserve("alice", { name: "../audio.mp3", size: 10, consent: true });
  expect(row.name).toBe("audio.mp3");
  expect(guard).toHaveBeenCalledWith("media-upload");
  await expect(api.upload("bob", row.id, 0, bytes(10))).rejects.toThrow("not found");
  expect(await api.list("bob")).toEqual([]);
});
test.each(["wav", "m4a", "webm", "ogg", "oga", "flac", "aac", "mov"])(
  "common %s recordings can be reserved",
  async (ext) => {
    const api = createMediaService(sql, guard, { putChunk: put, remove }, credential);
    const row = await api.reserve("alice", {
      name: `meeting.${ext.toUpperCase()}`,
      size: 10,
      consent: true,
    });
    expect(row.name).toBe(`meeting.${ext.toUpperCase()}`);
    expect(guard).toHaveBeenCalledWith("media-upload");
  },
);
test("unsupported speech models fail before captcha, job creation, or upload", async () => {
  const invalidCredential = vi.fn(async () => ({ model: "chat-only-model", cipher: "secret" }));
  const api = createMediaService(sql, guard, { putChunk: put, remove }, invalidCredential);
  await expect(
    api.reserve("alice", { name: "audio.mp3", size: 10, consent: true }),
  ).rejects.toThrow("does not support speech-to-text");
  expect(guard).not.toHaveBeenCalled();
  expect(await api.list("alice")).toEqual([]);
});
test("unsupported speech model setting fails before captcha or credentials are stored", async () => {
  const settingsGuard = vi.fn(async () => {});
  const settings = createTranscriptionSettings(sql, settingsGuard, "test-key-material-long-enough");
  await expect(
    settings.save("alice", {
      model: "chat-only-model",
      enabled: true,
      apiKey: "sk-secret",
    }),
  ).rejects.toThrow("does not support speech-to-text");
  expect(settingsGuard).not.toHaveBeenCalled();
  const rows = await sql<{ user_id: string }>`select user_id from transcription_settings`;
  expect(rows).toEqual([]);
});
test("chunk length/order are checked and uploads publish only after all bytes arrive", async () => {
  const api = createMediaService(sql, guard, { putChunk: put, remove }, credential);
  const row = await api.reserve("alice", { name: "audio.mp4", size: 10, consent: true });
  await expect(api.upload("alice", row.id, 1, bytes(10))).rejects.toThrow();
  await expect(api.upload("alice", row.id, 0, bytes(9))).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
  await api.upload("alice", row.id, 0, bytes(10));
  expect((await api.list("alice"))[0].status).toBe("queued");
  await expect(api.upload("alice", row.id, 0, bytes(10))).rejects.toThrow();
});
test("expiry prevents reads/uploads and acceptance removes media only for a ready owned transcript", async () => {
  const api = createMediaService(sql, guard, { putChunk: put, remove }, credential);
  const row = await api.reserve("alice", { name: "audio.mp3", size: 10, consent: true });
  await expect(api.accept("alice", row.id)).rejects.toThrow();
  await sql`update media_jobs set status='ready',transcript='Transcript' where id=${row.id}`;
  await expect(api.accept("bob", row.id)).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
  await api.accept("alice", row.id);
  expect(remove).toHaveBeenCalledWith(row.id);
  expect((await api.list("alice"))[0].status).toBe("accepted");
  expect(
    (await db.query<{ transcript: string }>("select transcript from media_jobs")).rows[0]
      .transcript,
  ).toBe("");
  const stale = await api.reserve("alice", { name: "audio.mp3", size: 10, consent: true });
  await sql`update media_jobs set expires_at=now()-interval '1 day' where id=${stale.id}`;
  await expect(api.upload("alice", stale.id, 0, bytes(10))).rejects.toThrow();
  expect(await api.list("alice")).toHaveLength(1);
});
