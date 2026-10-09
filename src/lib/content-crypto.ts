import { readKey } from "openpgp";
import { encryptNote } from "@/lib/vault-crypto";
export async function encryptPrivateContent(body: string, publicKey: string | undefined | null) {
  if (body.length > 100000) throw new Error("Content must be at most 100,000 characters");
  if (!publicKey) throw new Error("Create a Vault key before encrypting");
  return {
    ciphertext: await encryptNote(body, publicKey),
    fingerprint: (await readKey({ armoredKey: publicKey })).getFingerprint(),
  };
}
