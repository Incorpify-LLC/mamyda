export const RECOVERY_WARNING =
  "If you forget your Vault passphrase, Mamyda cannot reset it or recover your encrypted content. Keep your passphrase and encrypted key backup in separate safe places.";

/** Never let a stale/plaintext editor overwrite a protected body. */
export function assertContentWrite(
  plaintext: string | null | undefined,
  encrypted: boolean,
  alreadyEncrypted: boolean,
): void {
  if ((encrypted || alreadyEncrypted) && plaintext)
    throw new Error("Encrypted content must not be submitted as plaintext");
}
