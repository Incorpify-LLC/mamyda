import { expect, test, vi } from "vitest";
import {
  generateVaultKey,
  unlockPrivateKey,
  encryptNote,
  decryptNote,
  stashFromDecrypted,
  readStashedKey,
  clearUnlockedKey,
} from "@/lib/vault-crypto";
test("vault encrypts, rejects wrong passphrases and clears unlocked material", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    setItem: (k: string, v: string) => storage.set(k, v),
    getItem: (k: string) => storage.get(k),
    removeItem: (k: string) => storage.delete(k),
  });
  const pair = await generateVaultKey({
    name: "Test",
    email: "vault@example.test",
    passphrase: "a-long-test-passphrase",
  });
  await expect(unlockPrivateKey(pair.privateKey, "wrong")).rejects.toThrow();
  const key = await unlockPrivateKey(pair.privateKey, "a-long-test-passphrase");
  const cipher = await encryptNote("private body", pair.publicKey);
  expect(cipher).not.toContain("private body");
  expect(await decryptNote(cipher, key)).toBe("private body");
  await stashFromDecrypted(key);
  expect(storage.size).toBe(0);
  expect(await readStashedKey()).not.toBeNull();
  clearUnlockedKey();
  expect(await readStashedKey()).toBeNull();
  vi.unstubAllGlobals();
});
