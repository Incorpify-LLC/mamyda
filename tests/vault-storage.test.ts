import { expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { MAX_ASSET_BYTES } from "@/lib/vault-assets";
import {
  MAX_CIPHER_BYTES,
  readBoundedCipher,
  verifyStoredCipher,
  assetObjectKey,
} from "@/lib/mamyda/vault-storage.server";

async function* chunks(...values: Uint8Array[]) {
  yield* values;
}

test("ciphertext has a separate bounded allowance and rejects empty/truncated/oversize streams", async () => {
  expect(MAX_CIPHER_BYTES).toBeGreaterThan(MAX_ASSET_BYTES);
  await expect(readBoundedCipher(chunks(new Uint8Array([1, 2])), 2)).resolves.toEqual(
    new Uint8Array([1, 2]),
  );
  await expect(readBoundedCipher(chunks(), 1)).rejects.toThrow();
  await expect(readBoundedCipher(chunks(new Uint8Array([1])), 2)).rejects.toThrow();
  await expect(readBoundedCipher(chunks(new Uint8Array([1, 2])), 1)).rejects.toThrow();
  await expect(readBoundedCipher(chunks(), MAX_CIPHER_BYTES + 1)).rejects.toThrow();
});

test("oversize streaming aborts consumption immediately", async () => {
  const next = vi.fn();
  async function* malicious() {
    yield new Uint8Array([1, 2, 3]);
    next();
    yield new Uint8Array([4]);
  }
  await expect(readBoundedCipher(malicious(), 2)).rejects.toThrow();
  expect(next).not.toHaveBeenCalled();
});

test("finalization hashes actual object bytes rather than trusting client metadata", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const digest = createHash("sha256").update(bytes).digest("hex");
  await expect(verifyStoredCipher(chunks(bytes), 3, digest)).resolves.toBeUndefined();
  await expect(verifyStoredCipher(chunks(new Uint8Array([3, 2, 1])), 3, digest)).rejects.toThrow(
    /digest/i,
  );
  await expect(verifyStoredCipher(chunks(bytes), 3, "not-a-digest")).rejects.toThrow();
});

test("object keys isolate owners, reject arbitrary paths and never contain filenames", () => {
  const id = "a".repeat(32);
  const revision = "b".repeat(32);
  const alice = assetObjectKey("alice", id, revision);
  expect(alice).toMatch(/^assets\/[a-f0-9]{64}\/[a-f0-9]{32}\/[a-f0-9]{32}$/);
  expect(alice).not.toBe(assetObjectKey("bob", id, revision));
  expect(() => assetObjectKey("", id, revision)).toThrow();
  expect(() => assetObjectKey("alice", "../other", revision)).toThrow();
});
