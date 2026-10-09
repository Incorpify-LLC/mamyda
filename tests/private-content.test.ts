import { expect, test, vi, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { readKey } from "openpgp";
import { generateVaultKey, encryptNote, decryptNote, unlockPrivateKey } from "@/lib/vault-crypto";
import type { Sql } from "@/lib/db";
const put = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/mamyda/files", () => ({ writeFileObject: put }));
import { storePrivateContent } from "@/lib/mamyda/private-content.server";
let pair: { publicKey: string; privateKey: string }, fingerprint: string;
beforeAll(async () => {
  pair = await generateVaultKey({
    name: "Test",
    email: "test@example.com",
    passphrase: "correct password",
  });
  fingerprint = (await readKey({ armoredKey: pair.publicKey })).getFingerprint();
});
test("object storage receives ciphertext only and wrong passphrases cannot open it", async () => {
  put.mockClear();
  const sql = vi.fn(async () => [{ vault_public_key: pair.publicKey }]) as unknown as Sql;
  const payload = {
    ciphertext: await encryptNote("confidential body", pair.publicKey),
    fingerprint,
  };
  const key = await storePrivateContent(sql, "alice", payload);
  expect(key).toMatch(/^content\/[a-f0-9]{64}\//);
  const [, bytes] = put.mock.calls[0] as unknown as [string, Uint8Array];
  expect(new TextDecoder().decode(bytes)).not.toContain("confidential body");
  await expect(unlockPrivateKey(pair.privateKey, "wrong")).rejects.toThrow();
  expect(
    await decryptNote(
      payload.ciphertext,
      await unlockPrivateKey(pair.privateKey, "correct password"),
    ),
  ).toBe("confidential body");
  await expect(
    storePrivateContent(sql, "alice", { ...payload, fingerprint: "b".repeat(40) }),
  ).rejects.toThrow();
  await expect(
    storePrivateContent(sql, "alice", { ...payload, ciphertext: "plaintext" }),
  ).rejects.toThrow();
  const foreign = await generateVaultKey({
    name: "Other",
    email: "other@example.com",
    passphrase: "other password",
  });
  await expect(
    storePrivateContent(sql, "alice", {
      ...payload,
      ciphertext: await encryptNote("secret", foreign.publicKey),
    }),
  ).rejects.toThrow("not encrypted for this Vault key");
  expect(put).toHaveBeenCalledTimes(1);
});
test("database rejects plaintext alongside encrypted references while metadata remains readable", async () => {
  const db = new PGlite();
  try {
    for (const migration of ["0002_mamyda.sql", "0009_private_content.sql"])
      await db.exec(readFileSync(`migrations/${migration}`, "utf8"));
    await db.exec(`insert into notes(id,user_id,title,body,content_object_key,content_key_fingerprint)values('n','alice','Visible name','','object','fingerprint');
      insert into tasks(id,user_id,project_id,title,notes,content_object_key,content_key_fingerprint)values('t','alice','p','Visible task',null,'object','fingerprint')`);
    await expect(db.exec(`update notes set body='private' where id='n'`)).rejects.toThrow();
    await expect(db.exec(`update tasks set notes='private' where id='t'`)).rejects.toThrow();
    expect((await db.query(`select title,body from notes where id='n'`)).rows[0]).toEqual({
      title: "Visible name",
      body: "",
    });
  } finally {
    await db.close();
  }
});
