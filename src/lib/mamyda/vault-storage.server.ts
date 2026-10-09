import { createHash } from "node:crypto";
import { MAX_ASSET_BYTES } from "@/lib/vault-assets";

/** Binary OpenPGP framing allowance; never applied to original upload sizes. */
export const MAX_CIPHER_BYTES = MAX_ASSET_BYTES + 1024 * 1024;

function validateCipherSize(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CIPHER_BYTES) {
    throw new Error("Invalid encrypted asset size");
  }
}

/** Called only with owner/asset/revision resolved from an authenticated DB record. */
export function assetObjectKey(ownerId: string, assetId: string, revisionId: string): string {
  if (!ownerId || !/^[a-f0-9]{32}$/.test(assetId) || !/^[a-f0-9]{32}$/.test(revisionId)) {
    throw new Error("Invalid asset identity");
  }
  const owner = createHash("sha256").update(ownerId).digest("hex");
  return `assets/${owner}/${assetId}/${revisionId}`;
}

async function consumeCipher(
  body: AsyncIterable<Uint8Array>,
  expectedSize: number,
  consume: (chunk: Uint8Array) => void,
): Promise<void> {
  validateCipherSize(expectedSize);
  let total = 0;
  for await (const chunk of body) {
    if (!(chunk instanceof Uint8Array)) throw new Error("Invalid encrypted asset stream");
    total += chunk.byteLength;
    if (total > expectedSize) throw new Error("Encrypted asset exceeds declared size");
    consume(chunk);
  }
  if (total !== expectedSize) throw new Error("Encrypted asset is truncated");
}

/** Bounded download: never use an unbounded S3 transformToByteArray. */
export async function readBoundedCipher(
  body: AsyncIterable<Uint8Array>,
  expectedSize: number,
): Promise<Uint8Array> {
  validateCipherSize(expectedSize);
  const result = new Uint8Array(expectedSize);
  let offset = 0;
  await consumeCipher(body, expectedSize, (chunk) => {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return result;
}

/** Finalization must verify actual bytes, not an ETag or user-supplied checksum header. */
export async function verifyStoredCipher(
  body: AsyncIterable<Uint8Array>,
  expectedSize: number,
  expectedDigest: string,
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest)) throw new Error("Invalid encrypted asset digest");
  const hash = createHash("sha256");
  await consumeCipher(body, expectedSize, (chunk) => {
    hash.update(chunk);
  });
  if (hash.digest("hex") !== expectedDigest) throw new Error("Encrypted asset digest mismatch");
}
