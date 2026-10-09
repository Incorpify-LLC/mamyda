import { createHash, randomUUID } from "node:crypto";
import { readKey, readMessage } from "openpgp";
import type { Sql } from "@/lib/db";
import { writeFileObject } from "./files";
export async function storePrivateContent(
  sql: Sql,
  owner: string,
  payload: { ciphertext: string; fingerprint: string },
) {
  const profile = (
    await sql<{
      vault_public_key: string;
    }>`select vault_public_key from profiles where user_id=${owner}`
  )[0];
  if (!profile?.vault_public_key) throw new Error("Create your Vault key first");
  const key = await readKey({ armoredKey: profile.vault_public_key });
  if (key.getFingerprint() !== payload.fingerprint)
    throw new Error("Vault key changed; reload before saving");
  const message = await readMessage({ armoredMessage: payload.ciphertext });
  const recipients = message.getEncryptionKeyIDs().map((id) => id.toHex());
  if (!key.getKeyIDs().some((id) => recipients.includes(id.toHex())))
    throw new Error("Content is not encrypted for this Vault key");
  const objectKey = `content/${createHash("sha256").update(owner).digest("hex")}/${randomUUID()}`;
  await writeFileObject(
    objectKey,
    new TextEncoder().encode(payload.ciphertext),
    "application/pgp-encrypted",
  );
  return objectKey;
}
