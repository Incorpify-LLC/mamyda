import { beforeAll, afterAll, beforeEach, test, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Sql } from "@/lib/db";
import { createChatArchive } from "@/lib/mamyda/chat.server";
let db: PGlite, sql: Sql;
const guard = vi.fn(async () => {}),
  put = vi.fn(async () => "content/test/opaque-key");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("migrations/0011_daily_chats.sql", "utf8"));
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
  await db.exec("truncate llm_chats");
  vi.clearAllMocks();
});
const blob = JSON.stringify({
  version: 1,
  messages: [
    { role: "user", content: "private zebra" },
    { role: "assistant", content: "A response" },
  ],
});
const data = { date: "2026-10-08", title: "Daily", tags: ["release"], revision: 0, body: blob };
test("daily archive isolates owners and protects concurrent saves", async () => {
  const api = createChatArchive(sql, guard, put);
  const saved = await api.save("alice", data);
  expect(guard).toHaveBeenCalledWith("chat-save");
  expect((await api.list("alice", { search: "zebra" })).length).toBe(1);
  expect(await api.list("bob", { search: "" })).toEqual([]);
  await expect(api.load("bob", saved.id)).rejects.toThrow("not found");
  await expect(api.save("alice", data)).rejects.toThrow("changed");
  const updated = await api.save("alice", { ...data, id: saved.id, revision: 1 });
  expect(updated.revision).toBe(2);
  await expect(api.save("alice", { ...data, id: saved.id, revision: 1 })).rejects.toThrow(
    "changed",
  );
});
test("encrypted conversion clears plaintext and search indexes and cannot be downgraded", async () => {
  const api = createChatArchive(sql, guard, put);
  const saved = await api.save("alice", data);
  const locked = await api.save("alice", {
    ...data,
    id: saved.id,
    revision: 1,
    body: "",
    encryption: { ciphertext: "cipher", fingerprint: "a".repeat(40) },
  });
  expect(locked.body).toBe("");
  expect(locked.encrypted).toBe(true);
  expect(await api.list("alice", { search: "zebra" })).toEqual([]);
  expect((await api.list("alice", { search: "release" })).length).toBe(1);
  expect((await api.list("alice", { date: "2026-10-08" })).length).toBe(1);
  await expect(api.save("alice", { ...data, id: saved.id, revision: 2 })).rejects.toThrow(
    "plaintext",
  );
  await expect(sql`update llm_chats set body='leaked' where id=${saved.id}`).rejects.toThrow();
});
test("invalid dates/blobs and combined plaintext+ciphertext are rejected before object writes", async () => {
  const api = createChatArchive(sql, guard, put);
  await expect(api.save("alice", { ...data, date: "2026-02-31" })).rejects.toThrow();
  await expect(
    api.save("alice", {
      ...data,
      body: '{"version":1,"messages":[{"role":"system","content":"bad"}]}',
    }),
  ).rejects.toThrow();
  await expect(
    api.save("alice", {
      ...data,
      encryption: { ciphertext: "cipher", fingerprint: "a".repeat(40) },
    }),
  ).rejects.toThrow("plaintext");
  expect(put).not.toHaveBeenCalled();
});
