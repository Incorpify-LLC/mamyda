import { expect, test } from "vitest";
import { encryptAsset, decryptAsset, generateVaultKey, unlockPrivateKey } from "@/lib/vault-crypto";
import { ASSET_ENCRYPTION_FORMAT, MAX_ASSET_BYTES, validateAssetSize } from "@/lib/vault-assets";

test("asset size allows exactly 24 MiB and rejects invalid original sizes", () => {
  expect(MAX_ASSET_BYTES).toBe(24 * 1024 * 1024);
  expect(ASSET_ENCRYPTION_FORMAT).toBe("openpgp-binary-v1");
  expect(() => validateAssetSize(MAX_ASSET_BYTES)).not.toThrow();
  for (const size of [0, -1, 0.5, NaN, Infinity, MAX_ASSET_BYTES + 1]) {
    expect(() => validateAssetSize(size)).toThrow();
  }
});

test("binary assets round-trip and reject corrupted ciphertext and unrelated keys", async () => {
  const pair = await generateVaultKey({
    name: "Asset",
    email: "asset@example.test",
    passphrase: "test-passphrase",
  });
  const key = await unlockPrivateKey(pair.privateKey, "test-passphrase");
  await expect(encryptAsset(new Uint8Array(), pair.publicKey)).rejects.toThrow("24 MiB");
  await expect(encryptAsset(new Uint8Array(MAX_ASSET_BYTES + 1), pair.publicKey)).rejects.toThrow(
    "24 MiB",
  );
  const bytes = new Uint8Array([0, 255, 128, 1, 0, 42]);
  const cipher = await encryptAsset(bytes, pair.publicKey);
  expect(cipher).toBeInstanceOf(Uint8Array);
  expect(cipher).not.toEqual(bytes);
  expect(await decryptAsset(cipher, key)).toEqual(bytes);
  const corrupted = cipher.slice();
  corrupted[corrupted.length - 1] ^= 1;
  await expect(decryptAsset(corrupted, key)).rejects.toThrow();
  const other = await generateVaultKey({
    name: "Other",
    email: "other@example.test",
    passphrase: "other-passphrase",
  });
  const otherKey = await unlockPrivateKey(other.privateKey, "other-passphrase");
  await expect(decryptAsset(cipher, otherKey)).rejects.toThrow();
});

test("an asset at the 24 MiB boundary encrypts and decrypts without text conversion", async () => {
  const pair = await generateVaultKey({
    name: "Boundary",
    email: "boundary@example.test",
    passphrase: "test-passphrase",
  });
  const key = await unlockPrivateKey(pair.privateKey, "test-passphrase");
  const bytes = new Uint8Array(MAX_ASSET_BYTES);
  bytes[0] = 255;
  bytes[bytes.length - 1] = 128;
  const cipher = await encryptAsset(bytes, pair.publicKey);
  const decoded = await decryptAsset(cipher, key);
  expect(decoded.byteLength).toBe(bytes.byteLength);
  expect(decoded.every((value, index) => value === bytes[index])).toBe(true);
}, 30000);
