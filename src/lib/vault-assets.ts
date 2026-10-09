/** Original payload limit; encrypted transport has a separate storage policy. */
export const MAX_ASSET_BYTES = 24 * 1024 * 1024;
export const ASSET_ENCRYPTION_FORMAT = "openpgp-binary-v1" as const;

export function validateAssetSize(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ASSET_BYTES) {
    throw new Error("Asset must be between 1 byte and 24 MiB");
  }
}
