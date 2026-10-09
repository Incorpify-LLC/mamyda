import { beforeAll, beforeEach, afterAll, test, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Sql } from "@/lib/db";
import { createFileUploads } from "@/lib/mamyda/file-uploads.server";
let db: PGlite, sql: Sql;
const put = vi.fn(async (_key: string, _bytes: Uint8Array, _type: string) => {});
const guard = vi.fn(async (_action: string) => {});
let uploads: ReturnType<typeof createFileUploads>;
const input = () => ({
  clientId: "c",
  projectId: "p",
  files: [
    { name: "a.txt", size: 3, contentType: "text/plain" },
    { name: "b.pdf", size: 2, contentType: "application/pdf" },
  ],
});
async function* body() {
  yield new Uint8Array([1, 2, 3]);
}
beforeAll(async () => {
  db = new PGlite();
  for (const name of ["0002_mamyda.sql", "0003_home.sql", "0008_file_upload_batches.sql"])
    await db.exec(readFileSync(`migrations/${name}`, "utf8"));
  sql = (async (parts: TemplateStringsArray, ...args: unknown[]) => {
    const q = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    return (await db.query(q, args)).rows;
  }) as Sql;
  sql.query = async (q, args = []) => (await db.query(q, args)).rows as any;
  uploads = createFileUploads(sql, { put }, guard);
});
afterAll(async () => db?.close());
beforeEach(async () => {
  vi.clearAllMocks();
  await db.exec(`TRUNCATE file_upload_requests,client_files,clients,projects;
INSERT INTO clients(id,user_id,name)VALUES('c','alice','Alice');INSERT INTO projects(id,user_id,client_id,name,slug)VALUES('p','alice','c','Project','project'),('pb','bob','c','Other','other')`);
});
test("one gated batch creates owner-bound tickets and rejects foreign or unlinked projects", async () => {
  const tickets = await uploads.reserve("alice", input());
  expect(tickets).toHaveLength(2);
  expect(guard).toHaveBeenCalledWith("file-upload");
  await expect(uploads.reserve("alice", { ...input(), projectId: "pb" })).rejects.toThrow();
  await expect(uploads.reserve("alice", { ...input(), projectId: "" })).rejects.toThrow();
});
test("file transfer is bounded, private, idempotent and persists the project link", async () => {
  const [ticket] = await uploads.reserve("alice", input());
  await expect(uploads.upload("bob", ticket.id, body())).rejects.toThrow();
  await uploads.upload("alice", ticket.id, body());
  await uploads.upload("alice", ticket.id, body());
  expect(put).toHaveBeenCalledTimes(1);
  expect((await db.query("select project_id,byte_size from client_files")).rows[0]).toEqual({
    project_id: "p",
    byte_size: 3,
  });
});
test("truncation, expiry and failed storage leave no visible record and permit a retry", async () => {
  const [ticket] = await uploads.reserve("alice", input());
  await expect(
    uploads.upload(
      "alice",
      ticket.id,
      (async function* () {
        yield new Uint8Array([1]);
      })(),
    ),
  ).rejects.toThrow();
  put.mockRejectedValueOnce(new Error("offline"));
  await expect(uploads.upload("alice", ticket.id, body())).rejects.toThrow("offline");
  expect((await db.query("select id from client_files")).rows).toHaveLength(0);
  await uploads.upload("alice", ticket.id, body());
  const [, other] = await uploads.reserve("alice", input());
  await db.query(
    "update file_upload_requests set expires_at=now()-interval '1 second' where id=$1",
    [other.id],
  );
  await expect(uploads.upload("alice", other.id, body())).rejects.toThrow(/expired/);
});
