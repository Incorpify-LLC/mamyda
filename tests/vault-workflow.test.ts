import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Sql } from "@/lib/db";
import { createVaultWorkflow } from "@/lib/mamyda/vault-workflow.server";
import { generateVaultKey } from "@/lib/vault-crypto";
import { readKey } from "openpgp";

let db: PGlite;
let sql: Sql;
const objects = new Map<string, Uint8Array>();
const put = vi.fn(async (key: string, bytes: Uint8Array) => {
  objects.set(key, bytes);
});
const get = vi.fn(async (key: string) => {
  if (!objects.has(key)) throw new Error("Storage unavailable");
  return (async function* () {
    yield objects.get(key)!;
  })();
});
const remove = vi.fn(async (key: string) => {
  objects.delete(key);
});
const guard = vi.fn(async (_action: string) => {});
let workflow: ReturnType<typeof createVaultWorkflow>;
let publicKey: string;
let fingerprint: string;
const body = new Uint8Array([1, 2, 3]);
const input = () => ({
  kind: "file",
  title: "File",
  originalSize: 3,
  cipherSize: 3,
  digest: createHash("sha256").update(body).digest("hex"),
  contentType: "text/plain",
  keyFingerprint: fingerprint,
  clientId: "c1",
  projectId: "p1",
});
async function* stream(bytes = body) {
  yield bytes;
}

beforeAll(async () => {
  db = new PGlite();
  publicKey = (
    await generateVaultKey({
      name: "Alice",
      email: "alice@example.test",
      passphrase: "test-passphrase",
    })
  ).publicKey;
  fingerprint = (await readKey({ armoredKey: publicKey })).getFingerprint();
  await db.exec(readFileSync("migrations/0002_mamyda.sql", "utf8"));
  await db.exec(
    "INSERT INTO notes(id,user_id,title,body) VALUES('legacy','alice','Legacy','Keep me')",
  );
  await db.exec(readFileSync("migrations/0007_vault_assets.sql", "utf8"));
  sql = (async (parts: TemplateStringsArray, ...args: unknown[]) => {
    const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    return (await db.query(query, args)).rows;
  }) as Sql;
  sql.query = async (query, args = []) => (await db.query(query, args)).rows as any;
  workflow = createVaultWorkflow(sql, { bucket: "mamyda", put, get, remove }, guard);
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  vi.clearAllMocks();
  objects.clear();
  await db.exec(`TRUNCATE vault_asset_uploads, vault_assets, clients, projects, profiles;
    INSERT INTO clients(id,user_id,name) VALUES('c1','alice','Alice'),('cb','bob','Bob');
    INSERT INTO projects(id,user_id,client_id,name,slug) VALUES('p1','alice','c1','Project','project'),('pb','bob','cb','Bob','bob');
    INSERT INTO profiles(user_id,vault_public_key) VALUES('alice','configured'),('bob','configured');`);
  await db.query("UPDATE profiles SET vault_public_key=$1", [publicKey]);
});

test("expand migration preserves existing plaintext notes", async () => {
  expect((await db.query("SELECT body FROM notes WHERE id='legacy'")).rows[0]).toEqual({
    body: "Keep me",
  });
});
test("reserve rejects foreign associations and missing keys, and gates mutations", async () => {
  await expect(workflow.reserve("alice", { ...input(), projectId: "pb" })).rejects.toThrow();
  await expect(workflow.reserve("alice", { ...input(), clientId: "cb" })).rejects.toThrow();
  await db.exec("UPDATE profiles SET vault_public_key=NULL WHERE user_id='alice'");
  await expect(workflow.reserve("alice", input())).rejects.toThrow(/key/i);
  expect(guard).toHaveBeenCalledWith("vault-asset-write");
});
test("reservation enforces original/ciphertext limits and expiration", async () => {
  await expect(
    workflow.reserve("alice", { ...input(), originalSize: 24 * 1024 * 1024 + 1 }),
  ).rejects.toThrow();
  await expect(
    workflow.reserve("alice", { ...input(), cipherSize: 26 * 1024 * 1024 }),
  ).rejects.toThrow();
  const r = await workflow.reserve("alice", input());
  await db.query(
    "UPDATE vault_asset_uploads SET expires_at=now()-interval '1 second' WHERE id=$1",
    [r.uploadId],
  );
  await expect(workflow.upload("alice", r.uploadId, stream())).rejects.toThrow(/expired/i);
  expect(put).not.toHaveBeenCalled();
});
test("reservation rejects a stale key fingerprint and fails closed on CAPTCHA", async () => {
  await expect(
    workflow.reserve("alice", { ...input(), keyFingerprint: "0".repeat(40) }),
  ).rejects.toThrow(/key/i);
  guard.mockRejectedValueOnce(new Error("Security check failed"));
  await expect(workflow.reserve("alice", input())).rejects.toThrow("Security check failed");
  expect((await db.query("SELECT id FROM vault_assets")).rows).toHaveLength(0);
});
test("expired reservations can be replaced without discarding their object references", async () => {
  const r = await workflow.reserve("alice", input());
  await db.query(
    "UPDATE vault_asset_uploads SET expires_at=now()-interval '1 second' WHERE id=$1",
    [r.uploadId],
  );
  await workflow.reserve("alice", { ...input(), assetId: r.assetId });
  expect(
    (await db.query("SELECT state FROM vault_asset_uploads WHERE id=$1", [r.uploadId])).rows[0],
  ).toEqual({ state: "retired" });
});
test("concurrent finalize calls publish only one revision", async () => {
  const r = await workflow.reserve("alice", input());
  await workflow.upload("alice", r.uploadId, stream());
  await Promise.allSettled([
    workflow.finalize("alice", r.uploadId),
    workflow.finalize("alice", r.uploadId),
  ]);
  expect((await workflow.list("alice"))[0].current_revision).toBe(1);
  await workflow.finalize("alice", r.uploadId);
});

test("expiration during storage verification cannot publish an asset", async () => {
  const r = await workflow.reserve("alice", input());
  await workflow.upload("alice", r.uploadId, stream());
  get.mockImplementationOnce(async () => {
    await db.query(
      "UPDATE vault_asset_uploads SET expires_at=now()-interval '1 second' WHERE id=$1",
      [r.uploadId],
    );
    return stream();
  });
  await expect(workflow.finalize("alice", r.uploadId)).rejects.toThrow();
  expect(await workflow.list("alice")).toEqual([]);
});

test("concurrent transfers cannot overwrite a reserved revision", async () => {
  const r = await workflow.reserve("alice", input());
  const results = await Promise.allSettled([
    workflow.upload("alice", r.uploadId, stream()),
    workflow.upload("alice", r.uploadId, stream()),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(put).toHaveBeenCalledTimes(1);
});

test("database publication failure rolls back revision advancement and allows a safe retry", async () => {
  const r = await workflow.reserve("alice", input());
  await workflow.upload("alice", r.uploadId, stream());
  await db.exec(`CREATE FUNCTION reject_ready() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.state='ready' THEN RAISE EXCEPTION 'simulated DB failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER reject_ready BEFORE UPDATE ON vault_asset_uploads FOR EACH ROW EXECUTE FUNCTION reject_ready();`);
  try {
    await expect(workflow.finalize("alice", r.uploadId)).rejects.toThrow("simulated DB failure");
    expect(
      (await db.query("SELECT current_revision FROM vault_assets WHERE id=$1", [r.assetId]))
        .rows[0],
    ).toEqual({ current_revision: 0 });
    expect(
      (await db.query("SELECT state FROM vault_asset_uploads WHERE id=$1", [r.uploadId])).rows[0],
    ).toEqual({ state: "uploaded" });
  } finally {
    await db.exec("DROP TRIGGER reject_ready ON vault_asset_uploads; DROP FUNCTION reject_ready()");
  }
  await workflow.finalize("alice", r.uploadId);
  expect(await workflow.list("alice")).toHaveLength(1);
});
test("owner-scoped upload/finalization/read publish only verified ready content", async () => {
  const r = await workflow.reserve("alice", input());
  expect(await workflow.list("alice")).toEqual([]);
  await expect(workflow.upload("bob", r.uploadId, stream())).rejects.toThrow();
  await workflow.upload("alice", r.uploadId, stream());
  await expect(workflow.finalize("bob", r.uploadId)).rejects.toThrow();
  await workflow.finalize("alice", r.uploadId);
  await workflow.finalize("alice", r.uploadId); // Safe retry after a lost response.
  expect(await workflow.read("alice", r.assetId)).toEqual(body);
  expect(await workflow.list("bob")).toEqual([]);
  await expect(workflow.read("bob", r.assetId)).rejects.toThrow();
  expect(await workflow.list("alice")).toHaveLength(1);
});
test("tampered/truncated uploads never reach storage and can retry", async () => {
  const r = await workflow.reserve("alice", input());
  await expect(
    workflow.upload("alice", r.uploadId, stream(new Uint8Array([9, 9, 9]))),
  ).rejects.toThrow(/digest/i);
  await expect(workflow.upload("alice", r.uploadId, stream(new Uint8Array([1])))).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
  await workflow.upload("alice", r.uploadId, stream());
});
test("storage failures retain retryable metadata; finalization rechecks actual bytes", async () => {
  const r = await workflow.reserve("alice", input());
  put.mockRejectedValueOnce(new Error("S3 offline"));
  await expect(workflow.upload("alice", r.uploadId, stream())).rejects.toThrow("S3 offline");
  await workflow.upload("alice", r.uploadId, stream());
  for (const key of objects.keys()) objects.set(key, new Uint8Array([9, 9, 9]));
  await expect(workflow.finalize("alice", r.uploadId)).rejects.toThrow(/digest/i);
  expect(await workflow.list("alice")).toEqual([]);
});
test("new revisions require the current revision and keep previous content visible", async () => {
  const r = await workflow.reserve("alice", input());
  await workflow.upload("alice", r.uploadId, stream());
  await workflow.finalize("alice", r.uploadId);
  await expect(
    workflow.reserve("alice", { ...input(), assetId: r.assetId, baseRevision: 0 }),
  ).rejects.toThrow(/revision/i);
  const next = await workflow.reserve("alice", {
    ...input(),
    assetId: r.assetId,
    baseRevision: 1,
    title: "New",
  });
  expect((await workflow.list("alice"))[0].title).toBe("File");
  await expect(
    workflow.reserve("alice", { ...input(), assetId: r.assetId, baseRevision: 1 }),
  ).rejects.toThrow();
  await workflow.upload("alice", next.uploadId, stream());
  await workflow.finalize("alice", next.uploadId);
  expect((await workflow.list("alice"))[0].title).toBe("New");
});
test("deletion failures retain object references and tombstones for retries", async () => {
  const r = await workflow.reserve("alice", input());
  await workflow.upload("alice", r.uploadId, stream());
  await workflow.finalize("alice", r.uploadId);
  await expect(workflow.delete("bob", r.assetId)).rejects.toThrow();
  remove.mockRejectedValueOnce(new Error("S3 offline"));
  await expect(workflow.delete("alice", r.assetId)).rejects.toThrow("S3 offline");
  expect(
    (await db.query("SELECT object_key FROM vault_asset_uploads WHERE id=$1", [r.uploadId])).rows,
  ).toHaveLength(1);
  expect(await workflow.list("alice")).toEqual([]);
  await workflow.delete("alice", r.assetId);
  expect(objects.size).toBe(0);
});
